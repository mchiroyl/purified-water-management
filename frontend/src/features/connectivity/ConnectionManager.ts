import { registerOfflineCheck, resolveApiUrl } from '../../services/apiClient';

export type ConnectionState = 'UNKNOWN' | 'CHECKING' | 'OFFLINE' | 'DEGRADED' | 'ONLINE';
export type OperationalMode = 'AUTO' | 'FORCE_OFFLINE';
export type ConnectionCheckReason =
  | 'STARTUP'
  | 'FOREGROUND'
  | 'ONLINE_EVENT'
  | 'OFFLINE_EVENT'
  | 'BEFORE_SYNC'
  | 'REQUEST_FAILURE'
  | 'REQUEST_SUCCESS'
  | 'MANUAL'
  | 'RETRY';

export type ConnectionSnapshot = {
  state: ConnectionState;
  reason: ConnectionCheckReason | null;
  checkedAt: string | null;
  serverTime: string | null;
  retryCount: number;
  mode: OperationalMode;
};

type ConnectionManagerOptions = {
  endpoint?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  minimumIntervalMs?: number;
  retryBaseMs?: number;
  retryMaximumMs?: number;
  failureThreshold?: number;
  lifecycleTarget?: EventTarget;
  visibilityTarget?: EventTarget & Partial<Pick<Document, 'visibilityState'>>;
  now?: () => number;
  setTimer?: typeof window.setTimeout;
  clearTimer?: typeof window.clearTimeout;
};

const initialSnapshot: ConnectionSnapshot = {
  state: 'UNKNOWN',
  reason: null,
  checkedAt: null,
  serverTime: null,
  retryCount: 0,
  mode: 'AUTO',
};

export class ConnectionManager {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly minimumIntervalMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaximumMs: number;
  /** How many consecutive probe failures are required before going OFFLINE/DEGRADED */
  private readonly failureThreshold: number;
  private readonly lifecycleTarget?: EventTarget;
  private readonly visibilityTarget?: EventTarget & Partial<Pick<Document, 'visibilityState'>>;
  private readonly now: () => number;
  private readonly setTimer: typeof window.setTimeout;
  private readonly clearTimer: typeof window.clearTimeout;
  private readonly listeners = new Set<(snapshot: ConnectionSnapshot) => void>();
  private snapshot: ConnectionSnapshot = initialSnapshot;
  private mode: OperationalMode = 'AUTO';
  private inFlight?: Promise<ConnectionSnapshot>;
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private retryTimer?: number;
  private retryCount = 0;
  private consecutiveFailures = 0;
  private requestSuccessGeneration = 0;
  private activeAbort?: AbortController;
  private started = false;
  private requestFailureDebounceTimer?: number;

  constructor(options: ConnectionManagerOptions = {}) {
    this.endpoint = options.endpoint ?? resolveApiUrl('/connectivity');
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    // Minimum 5 s between probes – prevents hammering from multiple sync triggers
    this.minimumIntervalMs = options.minimumIntervalMs ?? 5_000;
    this.retryBaseMs = options.retryBaseMs ?? 5_000;
    this.retryMaximumMs = options.retryMaximumMs ?? 60_000;
    // Require 2 consecutive probe failures before marking offline (avoids single-packet loss)
    this.failureThreshold = options.failureThreshold ?? 2;
    this.lifecycleTarget = options.lifecycleTarget ?? (typeof window !== 'undefined' ? window : undefined);
    this.visibilityTarget = options.visibilityTarget ?? (typeof document !== 'undefined' ? document : undefined);
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? window.setTimeout.bind(window);
    this.clearTimer = options.clearTimer ?? window.clearTimeout.bind(window);
  }

  getSnapshot = () => this.snapshot;

  getMode = () => this.mode;

  isForceOffline = () => this.mode === 'FORCE_OFFLINE';

  setMode = (mode: OperationalMode) => {
    if (this.mode === mode) {
      if (mode === 'AUTO' && this.snapshot.state !== 'ONLINE') {
        void this.manualCheck();
      }
      return;
    }
    this.mode = mode;
    this.activeAbort?.abort();
    this.activeAbort = undefined;
    this.inFlight = undefined;
    this.clearRetry();
    this.retryCount = 0;
    this.lastStartedAt = Number.NEGATIVE_INFINITY;

    if (mode === 'FORCE_OFFLINE') {
      this.publish({
        ...this.snapshot,
        state: 'OFFLINE',
        mode: 'FORCE_OFFLINE',
        reason: 'MANUAL',
        checkedAt: new Date(this.now()).toISOString(),
      });
    } else {
      const isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.publish({
        ...this.snapshot,
        mode: 'AUTO',
        state: isBrowserOnline ? 'CHECKING' : 'OFFLINE',
        reason: 'MANUAL',
        checkedAt: new Date(this.now()).toISOString(),
      });
      void this.check('MANUAL', true);
    }
  };

  toggleMode = (): OperationalMode => {
    const next: OperationalMode = this.mode === 'FORCE_OFFLINE' ? 'AUTO' : 'FORCE_OFFLINE';
    this.setMode(next);
    return next;
  };

  subscribe = (listener: (snapshot: ConnectionSnapshot) => void) => {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  };

  start() {
    if (this.started) return;
    this.started = true;
    this.lifecycleTarget?.addEventListener('online', this.handleOnline);
    this.lifecycleTarget?.addEventListener('offline', this.handleOffline);
    this.lifecycleTarget?.addEventListener('focus', this.handleFocus);
    this.lifecycleTarget?.addEventListener('agua-pura:request-failure', this.handleRequestFailure);
    this.lifecycleTarget?.addEventListener('agua-pura:request-success', this.handleRequestSuccess);
    this.visibilityTarget?.addEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.mode !== 'FORCE_OFFLINE') {
      void this.check('STARTUP', true);
    }
  }

  stop() {
    this.started = false;
    this.lifecycleTarget?.removeEventListener('online', this.handleOnline);
    this.lifecycleTarget?.removeEventListener('offline', this.handleOffline);
    this.lifecycleTarget?.removeEventListener('focus', this.handleFocus);
    this.lifecycleTarget?.removeEventListener('agua-pura:request-failure', this.handleRequestFailure);
    this.lifecycleTarget?.removeEventListener('agua-pura:request-success', this.handleRequestSuccess);
    this.visibilityTarget?.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.activeAbort?.abort();
    this.activeAbort = undefined;
    this.inFlight = undefined;
    this.lastStartedAt = Number.NEGATIVE_INFINITY;
    this.clearRetry();
  }

  manualCheck() {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    this.clearRetry();
    this.retryCount = 0;
    return this.check('MANUAL', true);
  }

  beforeSync() {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    return this.check('BEFORE_SYNC', true);
  }

  afterRequestFailure() {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    // Debounce: do NOT re-probe on every individual API failure – only after 3 s of silence
    // to avoid rapid state oscillation when multiple queries fail simultaneously.
    if (this.requestFailureDebounceTimer !== undefined) return Promise.resolve(this.snapshot);
    this.requestFailureDebounceTimer = this.setTimer(() => {
      this.requestFailureDebounceTimer = undefined;
      // Only re-probe if still not ONLINE
      if (this.snapshot.state !== 'ONLINE') {
        void this.check('REQUEST_FAILURE');
      }
    }, 3_000);
    return Promise.resolve(this.snapshot);
  }

  check(reason: ConnectionCheckReason, force = false): Promise<ConnectionSnapshot> {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    if (this.inFlight) return this.inFlight;
    const startedAt = this.now();
    if (!force && startedAt - this.lastStartedAt < this.minimumIntervalMs) return Promise.resolve(this.snapshot);
    this.lastStartedAt = startedAt;
    this.publish({ ...this.snapshot, state: 'CHECKING', reason });
    const generation = this.requestSuccessGeneration;
    const flight = this.performCheck(reason, startedAt, generation);
    this.inFlight = flight;
    void flight.finally(() => {
      if (this.inFlight === flight) this.inFlight = undefined;
    });
    return flight;
  }

  private readonly handleOnline = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    this.clearRetry();
    this.retryCount = 0;
    void this.check('ONLINE_EVENT', true);
  };

  private readonly handleFocus = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    if (this.snapshot.state !== 'ONLINE') {
      this.clearRetry();
      this.retryCount = 0;
      void this.check('MANUAL', true);
    }
  };

  private readonly handleOffline = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    this.publish({
      ...this.snapshot,
      state: 'OFFLINE',
      reason: 'OFFLINE_EVENT',
      checkedAt: new Date(this.now()).toISOString(),
      serverTime: null,
    });
    this.scheduleRetry();
  };

  private readonly handleRequestFailure = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    void this.afterRequestFailure();
  };

  private readonly handleRequestSuccess = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    this.requestSuccessGeneration += 1;
    this.retryCount = 0;
    this.clearRetry();
    this.publish({
      ...this.snapshot,
      state: 'ONLINE',
      reason: 'REQUEST_SUCCESS',
      checkedAt: new Date(this.now()).toISOString(),
      serverTime: null,
      retryCount: 0,
    });
  };

  private readonly handleVisibilityChange = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    if (this.visibilityTarget?.visibilityState === 'visible') {
      this.clearRetry();
      this.retryCount = 0;
      void this.check('FOREGROUND');
    }
  };

  private async performCheck(reason: ConnectionCheckReason, startedAt: number, generation: number) {
    const controller = new AbortController();
    this.activeAbort = controller;
    const timeout = this.setTimer(() => controller.abort(), this.timeoutMs);
    // Append cache-busting param instead of cache:'no-store' to avoid CORS preflight on mobile browsers
    const probeUrl = `${this.endpoint}${this.endpoint.includes('?') ? '&' : '?'}_t=${startedAt}`;
    try {
      const response = await this.fetcher(probeUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      if (!response.ok) {
        // A non-ok response means the server is reachable but degraded
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures < this.failureThreshold) {
          // Not yet at threshold – keep current state, schedule a fast retry
          this.scheduleRetry(2_000);
          return this.snapshot;
        }
        return this.markUnavailable('DEGRADED', reason, startedAt);
      }
      const payload = await response.json().catch(() => ({})) as { serverTime?: string };
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      // Success – reset failure counters
      this.consecutiveFailures = 0;
      this.retryCount = 0;
      this.clearRetry();
      const online: ConnectionSnapshot = {
        state: 'ONLINE',
        reason,
        checkedAt: new Date(startedAt).toISOString(),
        serverTime: payload.serverTime ?? null,
        retryCount: 0,
        mode: this.mode,
      };
      this.publish(online);
      return online;
    } catch {
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures < this.failureThreshold) {
        // First failure: keep current state, schedule a fast retry silently
        this.scheduleRetry(3_000);
        return this.snapshot;
      }
      // Multiple consecutive failures → go OFFLINE
      return this.markUnavailable('OFFLINE', reason, startedAt);
    } finally {
      this.clearTimer(timeout);
      if (this.activeAbort === controller) this.activeAbort = undefined;
    }
  }

  private markUnavailable(state: 'DEGRADED' | 'OFFLINE', reason: ConnectionCheckReason, checkedAt: number) {
    const unavailable: ConnectionSnapshot = {
      state,
      reason,
      checkedAt: new Date(checkedAt).toISOString(),
      serverTime: null,
      retryCount: this.retryCount,
      mode: this.mode,
    };
    this.publish(unavailable);
    this.scheduleRetry();
    return unavailable;
  }

  private scheduleRetry(overrideDelayMs?: number) {
    if (this.retryTimer !== undefined) return;
    const delay = overrideDelayMs ?? Math.min(this.retryBaseMs * 2 ** this.retryCount, this.retryMaximumMs);
    this.retryCount += 1;
    this.publish({ ...this.snapshot, retryCount: this.retryCount });
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = undefined;
      void this.check('RETRY', true);
    }, delay);
  }

  private clearRetry() {
    if (this.retryTimer !== undefined) this.clearTimer(this.retryTimer);
    this.retryTimer = undefined;
    if (this.requestFailureDebounceTimer !== undefined) this.clearTimer(this.requestFailureDebounceTimer);
    this.requestFailureDebounceTimer = undefined;
  }

  private publish(snapshot: ConnectionSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const connectionManager = new ConnectionManager();
registerOfflineCheck(() => connectionManager.isForceOffline());
