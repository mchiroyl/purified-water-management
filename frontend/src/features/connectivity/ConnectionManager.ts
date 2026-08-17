export type ConnectionState = 'UNKNOWN' | 'CHECKING' | 'OFFLINE' | 'DEGRADED' | 'ONLINE';
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
};

type ConnectionManagerOptions = {
  endpoint?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  minimumIntervalMs?: number;
  retryBaseMs?: number;
  retryMaximumMs?: number;
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
};

export class ConnectionManager {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly minimumIntervalMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaximumMs: number;
  private readonly lifecycleTarget?: EventTarget;
  private readonly visibilityTarget?: EventTarget & Partial<Pick<Document, 'visibilityState'>>;
  private readonly now: () => number;
  private readonly setTimer: typeof window.setTimeout;
  private readonly clearTimer: typeof window.clearTimeout;
  private readonly listeners = new Set<(snapshot: ConnectionSnapshot) => void>();
  private snapshot: ConnectionSnapshot = initialSnapshot;
  private inFlight?: Promise<ConnectionSnapshot>;
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private retryTimer?: number;
  private retryCount = 0;
  private requestSuccessGeneration = 0;
  private activeAbort?: AbortController;
  private started = false;

  constructor(options: ConnectionManagerOptions = {}) {
    this.endpoint = options.endpoint ?? '/api/connectivity';
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.minimumIntervalMs = options.minimumIntervalMs ?? 2_000;
    this.retryBaseMs = options.retryBaseMs ?? 10_000;
    this.retryMaximumMs = options.retryMaximumMs ?? 60_000;
    this.lifecycleTarget = options.lifecycleTarget ?? (typeof window !== 'undefined' ? window : undefined);
    this.visibilityTarget = options.visibilityTarget ?? (typeof document !== 'undefined' ? document : undefined);
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? window.setTimeout.bind(window);
    this.clearTimer = options.clearTimer ?? window.clearTimeout.bind(window);
  }

  getSnapshot = () => this.snapshot;

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
    this.lifecycleTarget?.addEventListener('agua-pura:request-failure', this.handleRequestFailure);
    this.lifecycleTarget?.addEventListener('agua-pura:request-success', this.handleRequestSuccess);
    this.visibilityTarget?.addEventListener('visibilitychange', this.handleVisibilityChange);
    void this.check('STARTUP', true);
  }

  stop() {
    this.started = false;
    this.lifecycleTarget?.removeEventListener('online', this.handleOnline);
    this.lifecycleTarget?.removeEventListener('offline', this.handleOffline);
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
    return this.check('MANUAL', true);
  }

  beforeSync() {
    return this.check('BEFORE_SYNC', true);
  }

  afterRequestFailure() {
    return this.check('REQUEST_FAILURE');
  }

  check(reason: ConnectionCheckReason, force = false): Promise<ConnectionSnapshot> {
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
    void this.check('ONLINE_EVENT', true);
  };

  private readonly handleOffline = () => {
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
    void this.afterRequestFailure();
  };

  private readonly handleRequestSuccess = () => {
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
    if (this.visibilityTarget?.visibilityState === 'visible') void this.check('FOREGROUND');
  };

  private async performCheck(reason: ConnectionCheckReason, startedAt: number, generation: number) {
    const controller = new AbortController();
    this.activeAbort = controller;
    const timeout = this.setTimer(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(this.endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      if (!response.ok) {
        return this.markUnavailable('DEGRADED', reason, startedAt);
      }
      const payload = await response.json().catch(() => ({})) as { serverTime?: string };
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      this.retryCount = 0;
      this.clearRetry();
      const online: ConnectionSnapshot = {
        state: 'ONLINE',
        reason,
        checkedAt: new Date(startedAt).toISOString(),
        serverTime: payload.serverTime ?? null,
        retryCount: 0,
      };
      this.publish(online);
      return online;
    } catch {
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
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
    };
    this.publish(unavailable);
    this.scheduleRetry();
    return unavailable;
  }

  private scheduleRetry() {
    if (this.retryTimer !== undefined) return;
    const delay = Math.min(this.retryBaseMs * 2 ** this.retryCount, this.retryMaximumMs);
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
  }

  private publish(snapshot: ConnectionSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const connectionManager = new ConnectionManager();
