import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  Package,
  Wallet,
  Users,
  CreditCard,
  ArrowRightLeft,
  Receipt,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  FileText,
  BadgeAlert,
  Loader2,
  MapPin,
  ListOrdered,
  Droplets,
  ShieldCheck,
  Check,
  X,
  RotateCcw,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../PageHeader';
import type { SessionUser } from '../../features/auth/types';
import type { DailyItineraryRunResponse } from '../../features/routes/types';
import type { JugRouteSummaryResponse } from '../../features/jugs/types';
import { captureCurrentLocation } from '../../services/geolocation';
import { apiRequest } from '../../services/apiClient';
import { useSyncOptional, getMobileDatabase } from '../../offline/SyncContext';

type DashboardAlert = { code: string; severity: string; title: string; count: number };
type Dashboard = {
  generatedAt: string; timezone: string; currencyCode: string;
  salesToday: number; expectedCash: number; deliveredCash: number; transfers: number; credit: number;
  monetaryDifferences: number; inventoryDifferences: number; approvedWasteUnits: number;
  pendingWastes: number; provisionalCustomers: number; pendingTransfers: number;
  activeRoutes: number; completedRoutes: number; pendingOfflineOperations: number;
  pendingReturns: number; pendingAuthorizations: number; openIncidents: number; alerts: DashboardAlert[];
};

type Correction = { id: string; productId: string; productCode: string; productName: string; quantityDelta: number; reason: string };
type RouteLoadItem = { id: string; productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type RouteLoad = {
  id: string; loadNumber: string; routeId: string; routeCode: string; routeName: string;
  sourceLocationId: string; sourceLocationName: string; targetLocationId: string; targetLocationName: string;
  plannedDate: string; loadType: 'INITIAL' | 'REPLENISHMENT'; status: string;
  sellerReceivedByUsername?: string; sellerReceivedAt?: string;
  startedByUsername?: string; startedAt?: string;
  createdByUsername: string; createdAt?: string; items: RouteLoadItem[];
  corrections?: Correction[];
};

type Balance = { productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type Location = {
  id: string; code: string; name: string; locationType: string; routeId?: string; routeCode?: string; routeName?: string;
  active: boolean; balances: Balance[];
};

type SaleItem = {
  id: string;
  productId?: string;
  productCode?: string;
  productName: string;
  presentationName?: string;
  presentationQuantity: number;
  quantityBaseUnits: number;
  unitPrice: number;
  lineTotal: number;
};
type Payment = { id: string; method: string; amount: number; status: string };
type Sale = {
  id: string; documentNumber: string; routeId?: string; routeCode: string; routeName: string;
  sellerName: string; customerId?: string; customerName: string; status?: string; total: number; createdAt: string;
  items: SaleItem[]; payments?: Payment[]; createdByUsername?: string; routeLoadId?: string;
};

function money(value: number, currency = 'GTQ'): string {
  return `${currency === 'GTQ' ? 'Q' : `${currency} `}${Number(value || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function cleanDisplayText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/Abarroter\?\?a/gi, 'Abarrotería')
    .replace(/Bendici\?\?n/gi, 'Bendición')
    .replace(/\?\?/g, 'í')
    .replace(/\uFFFD/g, 'í');
}

function getSaleDate(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

export function SellerDashboard({
  user,
  dashboard,
  loads,
  locations,
  sales,
  settlements = [],
  isRefreshing,
  onRefresh
}: {
  user: SessionUser;
  dashboard: Dashboard;
  loads: RouteLoad[];
  locations: Location[];
  sales: Sale[];
  settlements?: any[];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const todayGuatemala = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, []);

  const sellerLoads = loads.filter(l => {
    const sellerMatch = l.sellerReceivedByUsername === user.username || l.createdByUsername === user.username;
    const dateMatch = l.plannedDate === todayGuatemala;
    return sellerMatch || dateMatch;
  });

  const sellerLoad = 
    sellerLoads.find(l => l.status === 'STARTED' && (l.sellerReceivedByUsername === user.username || l.createdByUsername === user.username)) ||
    loads.find(l => l.status === 'STARTED') ||
    sellerLoads.find(l => l.status === 'RECEIVED' && (l.sellerReceivedByUsername === user.username || l.createdByUsername === user.username)) ||
    sellerLoads.find(l => l.status === 'SETTLED') ||
    sellerLoads[0] ||
    loads.find(l => l.status === 'STARTED') ||
    loads[0];

  const settlementsList = Array.isArray(settlements) ? settlements : [];
  const currentSettlement = settlementsList.find(st => {
    if (!sellerLoad) return false;
    return st.routeLoadId && sellerLoad.id && st.routeLoadId === sellerLoad.id;
  });

  const isSettled = sellerLoad?.status === 'SETTLED' || currentSettlement?.status === 'CONFIRMED' || currentSettlement?.status === 'SETTLED';
  const isPendingReceipt = sellerLoad?.status === 'WAREHOUSE_CONFIRMED' || sellerLoad?.status === 'PREPARED';
  const isActiveLoad = sellerLoad && (sellerLoad.status === 'STARTED' || sellerLoad.status === 'RECEIVED');

  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveProgress, setReceiveProgress] = useState('');
  const [receiveError, setReceiveError] = useState('');
  const [receiptSuccessModal, setReceiptSuccessModal] = useState<{ loadNumber: string; itemsCount: number } | null>(null);

  const handleConfirmReceipt = async () => {
    if (!sellerLoad) return;
    setIsReceiving(true);
    setReceiveError('');
    setReceiveProgress('Obteniendo coordenadas GPS…');
    try {
      const location = await captureCurrentLocation('confirmar recepción de la carga', {
        onProgress: (p) => {
          if (p.accuracyMeters !== null) {
            setReceiveProgress(p.accuracyMeters <= 10 ? '¡Precisión alcanzada!' : `GPS: ±${Math.round(p.accuracyMeters)}m [${p.elapsedSeconds}s]`);
          } else {
            setReceiveProgress(`Buscando GPS (${p.elapsedSeconds}s)…`);
          }
        },
      });
      setReceiveProgress('Registrando recepción en camión…');
      await apiRequest(`/loads/${sellerLoad.id}/receipt`, {
        method: 'POST',
        body: JSON.stringify({ location }),
      });
      if (sellerLoad.loadType !== 'REPLENISHMENT') {
        try {
          await apiRequest(`/loads/${sellerLoad.id}/start`, { method: 'POST' });
        } catch {
          // ignore if already started
        }
      }
      setReceiptSuccessModal({
        loadNumber: String(sellerLoad.loadNumber),
        itemsCount: sellerLoad.items?.length || 0,
      });
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : 'Error al confirmar la recepción');
    } finally {
      setIsReceiving(false);
      setReceiveProgress('');
    }
  };

  let loadStartTime: string | undefined = undefined;
  if (sellerLoad) {
    loadStartTime = sellerLoad.startedAt || sellerLoad.sellerReceivedAt || sellerLoad.createdAt;
  }

  const sellerSales = useMemo(() => {
    return sales.filter(s => {
      const isCancelled = s.status && ['CANCELLED', 'ANNULLED', 'ANULADA'].includes(s.status.toUpperCase());
      if (isCancelled) {
        return false;
      }

      // Si la carga tiene ruta definida, las ventas registradas para esa ruta pertenecen a la jornada
      if (sellerLoad?.routeId && s.routeId && s.routeId !== sellerLoad.routeId) {
        return false;
      }
      if (sellerLoad?.routeCode && s.routeCode && s.routeCode !== sellerLoad.routeCode) {
        return false;
      }

      // Coincidencia de vendedor (por usuario o nombre de vendedor)
      if (s.createdByUsername && s.createdByUsername !== user.username) {
        return false;
      }
      if (s.sellerName && !s.createdByUsername) {
        const sNorm = normalizeText(s.sellerName);
        const uNorm = normalizeText(user.username);
        const dNorm = normalizeText(user.displayName);
        const tokens = sNorm.split(/\s+/);
        const matchesUser = 
          sNorm.includes(uNorm) || 
          uNorm.includes(sNorm) ||
          (dNorm && (sNorm.includes(dNorm) || dNorm.includes(sNorm))) ||
          tokens.some(t => t.length >= 4 && (uNorm.includes(t) || (dNorm && dNorm.includes(t))));
        if (!matchesUser && (dNorm || uNorm)) {
          return false;
        }
      }

      // Validación por fecha de jornada (comparando YYYY-MM-DD):
      const saleDate = getSaleDate(s.createdAt);
      const isToday = saleDate === todayGuatemala;
      const isLoadDate = sellerLoad?.plannedDate ? saleDate === sellerLoad.plannedDate.slice(0, 10) : false;
      const isDirectlyLinked = Boolean(s.routeLoadId && sellerLoad?.id && s.routeLoadId === sellerLoad.id);

      // Si la venta no es de hoy, ni de la fecha de la carga, ni está vinculada directamente, no pertenece a esta jornada
      if (!isToday && !isLoadDate && !isDirectlyLinked) {
        return false;
      }

      // Protección adicional para descartar ventas históricas de meses pasados
      if (loadStartTime) {
        const loadStartMs = new Date(loadStartTime).getTime();
        const saleMs = new Date(s.createdAt).getTime();
        if (saleMs < loadStartMs - 12 * 3600 * 1000) {
          return false;
        }
      }

      return true;
    });
  }, [sales, sellerLoad, user, todayGuatemala, loadStartTime]);

  const routeReplenishments = loads.filter(l => 
    sellerLoad &&
    l.routeId === sellerLoad.routeId &&
    l.loadType === 'REPLENISHMENT' &&
    l.id !== sellerLoad.id &&
    (l.status === 'STARTED' || l.status === 'RECEIVED' || l.status === 'SETTLED') &&
    (
      (loadStartTime && l.sellerReceivedAt && new Date(l.sellerReceivedAt).getTime() >= new Date(loadStartTime).getTime()) ||
      (l.plannedDate && sellerLoad.plannedDate && l.plannedDate === sellerLoad.plannedDate)
    )
  );

  const truckItems = (sellerLoad?.items ?? []).map(item => {
    // Si tenemos liquidación calculada oficial del backend para esta carga, usamos sus datos exactos
    const settlementItem = currentSettlement?.items?.find((it: any) => 
      (it.productId && item.productId && it.productId === item.productId) ||
      (it.productCode && item.productCode && it.productCode === item.productCode)
    );

    if (settlementItem) {
      const totalItemLoaded = Number(settlementItem.loadedUnits ?? item.quantityBaseUnits ?? 0);
      const soldQty = Number(settlementItem.soldUnits ?? 0);
      const wasteUnits = Number(settlementItem.approvedWasteUnits ?? 0);
      const remainingOnTruck = isSettled ? 0 : Math.max(0, totalItemLoaded - soldQty - wasteUnits);
      return {
        ...item,
        quantityBaseUnits: totalItemLoaded,
        soldQty,
        remainingOnTruck
      };
    }

    // Fallback reactivo si aún no se ha obtenido el cálculo de liquidación:
    const replenishmentUnits = routeReplenishments.reduce((acc, rep) => {
      const match = rep.items?.find(it => 
        (it.productId && item.productId && it.productId === item.productId) ||
        (it.productCode && item.productCode && it.productCode === item.productCode)
      );
      return acc + Number(match?.quantityBaseUnits || 0);
    }, 0);

    const correctionUnits = (sellerLoad?.corrections ?? []).reduce((acc, corr) => {
      const isMatch = (corr.productId && item.productId && corr.productId === item.productId) ||
                      (corr.productCode && item.productCode && corr.productCode === item.productCode);
      return isMatch ? acc + Number(corr.quantityDelta || 0) : acc;
    }, 0);

    const totalItemLoaded = Number(item.quantityBaseUnits || 0) + replenishmentUnits + correctionUnits;

    // Coincidencia precisa por productId o productCode para no confundir productos distintos
    const rawSoldQty = sellerSales.reduce((acc, s) => {
      const matches = s.items?.filter(it => {
        if (it.productId && item.productId) {
          return it.productId === item.productId;
        }
        if (it.productCode && item.productCode) {
          return it.productCode === item.productCode;
        }
        if (!it.productId && !it.productCode) {
          const itemNorm = normalizeText(item.productName);
          const itProdNorm = normalizeText(it.productName);
          return Boolean(itemNorm && itProdNorm && itemNorm === itProdNorm);
        }
        return false;
      });
      const lineSum = matches?.reduce((iAcc, it) => iAcc + Number(it.quantityBaseUnits || it.presentationQuantity || 0), 0) || 0;
      return acc + lineSum;
    }, 0);

    if (isSettled) {
      return {
        ...item,
        quantityBaseUnits: totalItemLoaded,
        soldQty: Math.min(totalItemLoaded, rawSoldQty || totalItemLoaded),
        remainingOnTruck: 0
      };
    }

    const soldQty = Number(rawSoldQty || 0);
    const remainingOnTruck = Math.max(0, totalItemLoaded - soldQty);

    return {
      ...item,
      quantityBaseUnits: totalItemLoaded,
      soldQty,
      remainingOnTruck
    };
  });

  const totalSoldUnits = truckItems.reduce((acc, it) => acc + it.soldQty, 0);
  const totalLoadedUnits = truckItems.reduce((acc, it) => acc + Number(it.quantityBaseUnits || 0), 0);
  const remainingTotalUnits = isSettled ? 0 : truckItems.reduce((acc, it) => acc + it.remainingOnTruck, 0);
  const progressPct = totalLoadedUnits > 0 ? Math.min(100, Math.round((totalSoldUnits / totalLoadedUnits) * 100)) : 0;

  const loadStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      STARTED: 'En ruta',
      RECEIVED: 'Recibida',
      PREPARED: 'Preparada',
      WAREHOUSE_CONFIRMED: 'Confirmada',
      SETTLED: 'Liquidada',
      CANCELLED: 'Cancelada',
    };
    return labels[status] ?? status;
  };

  const localSalesToday = sellerSales.reduce((acc, s) => acc + Number(s.total || 0), 0);

  const localCash = sellerSales.reduce((acc, s) => {
    if (!s.payments || s.payments.length === 0) {
      return acc + Number(s.total || 0);
    }
    const cashPayments = s.payments.filter(p => p.method === 'CASH' && (p.status === 'CONFIRMED' || p.status === 'APPLIED'));
    return acc + cashPayments.reduce((pAcc, p) => pAcc + Number(p.amount || 0), 0);
  }, 0);

  const localTransfers = sellerSales.reduce((acc, s) => {
    const transferPayments = (s.payments ?? []).filter(p => p.method === 'TRANSFER' && p.status !== 'REJECTED');
    return acc + transferPayments.reduce((pAcc, p) => pAcc + Number(p.amount || 0), 0);
  }, 0);

  const localCredit = sellerSales.reduce((acc, s) => {
    const creditPayments = (s.payments ?? []).filter(p => p.method === 'CREDIT' && (p.status === 'APPLIED' || p.status === 'CONFIRMED'));
    return acc + creditPayments.reduce((pAcc, p) => pAcc + Number(p.amount || 0), 0);
  }, 0);

  const effectiveSalesToday = currentSettlement?.salesTotal != null
    ? Number(currentSettlement.salesTotal)
    : localSalesToday;

  const effectiveCash = currentSettlement?.salesCash != null
    ? Number(currentSettlement.salesCash)
    : localCash;

  const effectiveTransfers = currentSettlement?.verifiedTransfers != null
    ? Number(currentSettlement.verifiedTransfers)
    : localTransfers;

  const effectiveCredit = currentSettlement?.appliedCredit != null
    ? Number(currentSettlement.appliedCredit)
    : localCredit;

  const creditCollectionsCash = Number(currentSettlement?.creditCollectionsCash || 0);

  // Efectivo físico a entregar: Ventas en efectivo + Abonos cobrados en efectivo
  const cashInHand = isSettled
    ? 0
    : currentSettlement?.expectedCash != null
      ? Number(currentSettlement.expectedCash)
      : Math.max(0, effectiveCash + creditCollectionsCash);

  const effectiveRouteId = sellerLoad?.routeId;

  const activeItinerary = useQuery({
    queryKey: ['itineraries', 'active', effectiveRouteId],
    queryFn: async () => {
      const url = effectiveRouteId ? `/routes/${effectiveRouteId}/itineraries/active` : '/itineraries/my-active';
      try {
        const res = await apiRequest<DailyItineraryRunResponse>(url);
        return res ?? null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(effectiveRouteId || user.roles?.includes('VENDEDOR')),
    staleTime: 15_000,
  });

  const routeJugsQuery = useQuery({
    queryKey: ['jugs', 'route-summary', effectiveRouteId],
    queryFn: async () => {
      if (!effectiveRouteId) return null;
      try {
        return await apiRequest<JugRouteSummaryResponse>(`/jugs/routes/${effectiveRouteId}/summary`);
      } catch {
        return null;
      }
    },
    enabled: Boolean(effectiveRouteId),
    staleTime: 30_000,
  });

  const routeTemplatesQuery = useQuery({
    queryKey: ['routes', effectiveRouteId, 'templates'],
    queryFn: async () => {
      if (!effectiveRouteId) return [];
      try {
        return await apiRequest<any[]>(`/routes/${effectiveRouteId}/templates`);
      } catch {
        return [];
      }
    },
    enabled: Boolean(effectiveRouteId),
    staleTime: 60_000,
  });

  const routeCustomersQuery = useQuery({
    queryKey: ['customers', 'route', effectiveRouteId, sellerLoad?.routeCode],
    queryFn: async () => {
      try {
        const all = await apiRequest<any[]>('/customers');
        return all.filter((c: any) => 
          (effectiveRouteId && c.routeId === effectiveRouteId) || 
          (sellerLoad?.routeCode && c.routeCode === sellerLoad.routeCode)
        );
      } catch {
        return [];
      }
    },
    enabled: Boolean(effectiveRouteId || sellerLoad?.routeCode),
    staleTime: 60_000,
  });

  const itineraryData = activeItinerary.data;
  const itineraryStops = itineraryData?.stops || [];

  type SellerStopItem = {
    id: string;
    runId?: string;
    customerId: string;
    customerCode: string;
    customerName: string;
    stopOrder: number;
    addressReference?: string | null;
    status: 'PENDING' | 'ATTENDED_SALE' | 'ATTENDED_NO_PURCHASE' | 'POSTPONED_BLOCKED';
    hasLocationMismatch?: boolean;
  };

  const syncContext = useSyncOptional();
  const operations = syncContext?.operations ?? [];

  const localSalesQuery = useQuery({
    queryKey: ['localSales', operations.length],
    queryFn: async () => {
      try {
        const db = await getMobileDatabase();
        return await db.getAll('localSales');
      } catch {
        return [];
      }
    },
    staleTime: 5_000,
  });

  const localAttendedCustomerIds = useMemo(() => {
    const sold = new Set<string>();
    const noPurchase = new Set<string>();

    for (const ls of localSalesQuery.data ?? []) {
      if (ls.customerId) sold.add(ls.customerId);
    }

    for (const op of operations) {
      if (op.status === 'REJECTED') continue;
      try {
        const p = (typeof op.payload === 'string' ? JSON.parse(op.payload) : op.payload) as Record<string, any>;
        if (op.entityType === 'SALE' && p?.customerId) {
          sold.add(String(p.customerId));
        }
        if (op.entityType === 'NO_PURCHASE_VISIT' && p?.customerId) {
          noPurchase.add(String(p.customerId));
        }
      } catch {}
    }

    return { sold, noPurchase };
  }, [localSalesQuery.data, operations]);

  const effectiveStops = useMemo<SellerStopItem[]>(() => {
    let rawStops: SellerStopItem[] = [];

    if (itineraryStops && itineraryStops.length > 0) {
      rawStops = itineraryStops.map((s: any) => ({
        id: String(s.id),
        runId: s.runId,
        customerId: String(s.customerId || ''),
        customerCode: String(s.customerCode || ''),
        customerName: String(s.customerName || ''),
        stopOrder: Number(s.stopOrder || 1),
        addressReference: s.addressReference ?? null,
        status: s.status,
        hasLocationMismatch: Boolean(s.hasLocationMismatch),
      }));
    } else if (routeTemplatesQuery.data?.[0]?.stops?.length) {
      const tStops = routeTemplatesQuery.data[0].stops;
      rawStops = tStops.map((ts: any, idx: number): SellerStopItem => ({
        id: String(ts.id || `tpl-${idx}`),
        runId: '',
        customerId: String(ts.customerId || ''),
        customerCode: String(ts.customerCode || ''),
        customerName: String(ts.customerName || ''),
        stopOrder: Number(ts.stopOrder || idx + 1),
        addressReference: ts.addressReference ?? null,
        status: 'PENDING',
        hasLocationMismatch: false,
      }));
    } else if (routeCustomersQuery.data?.length) {
      const custs = routeCustomersQuery.data;
      rawStops = custs.map((c: any, idx: number): SellerStopItem => ({
        id: String(c.id),
        runId: '',
        customerId: String(c.id),
        customerCode: String(c.code || ''),
        customerName: String(c.name || ''),
        stopOrder: idx + 1,
        addressReference: c.addressReference ?? null,
        status: 'PENDING',
        hasLocationMismatch: false,
      }));
    }

    return rawStops.map((stop): SellerStopItem => {
      const isServerSold = stop.status === 'ATTENDED_SALE' || sellerSales.some(s => 
        (s.customerId && stop.customerId && s.customerId === stop.customerId) ||
        (s.customerName && stop.customerName && normalizeText(s.customerName) === normalizeText(stop.customerName))
      );
      const isLocalSold = Boolean(stop.customerId && localAttendedCustomerIds.sold.has(stop.customerId));

      if (isServerSold || isLocalSold) {
        return { ...stop, status: 'ATTENDED_SALE' };
      }

      const isServerNoPurchase = stop.status === 'ATTENDED_NO_PURCHASE';
      const isLocalNoPurchase = Boolean(stop.customerId && localAttendedCustomerIds.noPurchase.has(stop.customerId));

      if (isServerNoPurchase || isLocalNoPurchase) {
        return { ...stop, status: 'ATTENDED_NO_PURCHASE' };
      }

      return stop;
    });
  }, [itineraryStops, routeTemplatesQuery.data, routeCustomersQuery.data, sellerSales, localAttendedCustomerIds]);

  const displayTotalStops = effectiveStops.length;
  const attendedCount = effectiveStops.filter(
    (s: SellerStopItem) => s.status === 'ATTENDED_SALE' || s.status === 'ATTENDED_NO_PURCHASE'
  ).length;
  const itineraryProgressPct = displayTotalStops > 0 ? Math.min(100, Math.round((attendedCount / displayTotalStops) * 100)) : 0;
  const nextPendingStop = effectiveStops.find((s: SellerStopItem) => s.status === 'PENDING');

  const specificJugItem = truckItems.find(it => {
    const norm = normalizeText(it.productName);
    return norm.includes('garrafon') || norm.includes('20l') || norm.includes('bidon');
  });

  const jugItem = specificJugItem;
  const jugsLoaded = jugItem ? Number(jugItem.quantityBaseUnits || 0) : totalLoadedUnits;
  const jugsRemaining = isSettled ? 0 : (jugItem ? Number(jugItem.remainingOnTruck || 0) : remainingTotalUnits);
  const jugsSold = jugItem ? Number(jugItem.soldQty || 0) : totalSoldUnits;
  const jugsEmptyRecovered = jugsSold;
  const totalJugsLentOnRoute = routeJugsQuery.data?.totalJugsOutstanding ?? 0;

  const handleRefreshAll = async () => {
    if (syncContext) {
      try {
        await syncContext.syncNow();
      } catch {
        // el motor de sincronización gestiona reintentos y estados internamente
      }
    }
    void activeItinerary.refetch();
    void routeJugsQuery.refetch();
    void routeTemplatesQuery.refetch();
    void routeCustomersQuery.refetch();
    onRefresh();
  };

  return (
    <div className="seller-cockpit-container">
      <style>{`
        .seller-cockpit-container {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          padding: 0.35rem 0.5rem 5.5rem;
          min-width: 0;
          box-sizing: border-box;
        }
        @media (min-width: 640px) {
          .seller-cockpit-container {
            max-width: 720px;
            padding: 0.75rem 1rem 5rem;
          }
        }
        @media (min-width: 860px) {
          .seller-cockpit-container {
            max-width: 980px;
            padding: 1rem 1.5rem 5rem;
          }
          .seller-cockpit-kpi-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
        @media (min-width: 1120px) {
          .seller-cockpit-container {
            max-width: 1240px;
            padding: 1.25rem 2rem 4rem;
          }
        }
        .seller-stop-node-link {
          text-decoration: none !important;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .seller-stop-node-link:hover {
          transform: translateY(-2px) scale(1.08);
          filter: brightness(1.05);
        }
      `}</style>
      {/* ── 1. Encabezado de Usuario y Estado (Idéntico a la Maqueta) ───── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: '0.85rem 1rem',
        marginBottom: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: '#0284c7',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Vendedor en ruta
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              ¡Hola, {user.displayName || user.username}! {sellerLoad ? `· ${sellerLoad.routeCode || sellerLoad.routeName}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '1px 7px',
                borderRadius: '999px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                {sellerLoad ? loadStatusLabel(sellerLoad.status) : 'En línea'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          style={{
            border: 'none',
            background: '#f1f5f9',
            color: '#475569',
            borderRadius: '8px',
            padding: '5px 9px',
            fontSize: '0.76rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? '…' : 'Sincronizar'}</span>
        </button>
      </div>

      {/* ── 2. Indicadores Clave (2x2 Grid Exacto a la Maqueta en móvil, 4 col en pantallas grandes) ── */}
      <div className="seller-cockpit-kpi-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.65rem',
        marginBottom: '0.75rem'
      }}>
        {/* Card 1: Ventas de Hoy */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
            Ventas de Hoy
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', fontFeatureSettings: '"tnum"', lineHeight: 1.2 }}>
            {money(effectiveSalesToday, dashboard.currencyCode)}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Efec: {money(effectiveCash)}
          </div>
        </div>

        {/* Card 2: Efectivo en Mano */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
            Efectivo en mano (A entregar)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', fontFeatureSettings: '"tnum"', lineHeight: 1.2 }}>
            {money(cashInHand, dashboard.currencyCode)}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.25rem' }}>
            {isSettled ? 'Liquidado' : `${money(cashInHand)} a rendir`}
          </div>
        </div>

        {/* Card 3: Garrafones o Unidades a Bordo */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
            {jugItem ? 'Garrafones a Bordo' : 'Unidades a Bordo'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', fontFeatureSettings: '"tnum"', lineHeight: 1.2 }}>
              {jugsRemaining}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              restantes de {jugsLoaded || totalLoadedUnits}
            </span>
          </div>
        </div>

        {/* Card 4: Avance de Ruta */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '0.85rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
            Avance de Ruta
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', fontFeatureSettings: '"tnum"', lineHeight: 1.2 }}>
              {displayTotalStops > 0 ? `${attendedCount}/${displayTotalStops}` : '0/0'}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              paradas atendidas {itineraryProgressPct}%
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Route Itinerary Progress (Stepper Conectado con navegación directa a Ventas) ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: '0.9rem 1rem',
        marginBottom: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        border: '1px solid #f1f5f9'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
            Route Itinerary Progress
          </h3>
          <Link
            to="/itinerary"
            style={{
              fontSize: '0.76rem',
              color: '#0284c7',
              textDecoration: 'none',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <span>Ver lista</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        {effectiveStops.length > 0 ? (
          <div>
            {/* Tira del Stepper horizontal con líneas conectoras y clic directo para vender */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              overflowX: 'auto',
              padding: '0.25rem 0.2rem 0.6rem',
              scrollbarWidth: 'none'
            }}>
              {effectiveStops.map((stop, idx) => {
                const isAttendedSale = stop.status === 'ATTENDED_SALE';
                const isNoPurchase = stop.status === 'ATTENDED_NO_PURCHASE';
                const isNext = stop.id === nextPendingStop?.id;
                const isPostponed = stop.status === 'POSTPONED_BLOCKED';
                const isLast = idx === effectiveStops.length - 1;
                const cleanName = cleanDisplayText(stop.customerName);
                const targetUrl = stop.customerId
                  ? `/sales?customerId=${encodeURIComponent(stop.customerId)}&routeId=${encodeURIComponent(effectiveRouteId || '')}`
                  : '/sales';

                const tooltipText = isAttendedSale
                  ? `Parada #${stop.stopOrder}: ${cleanName} - Venta realizada ✓`
                  : isNoPurchase
                    ? `Parada #${stop.stopOrder}: ${cleanName} - Visita sin compra registrada`
                    : isNext
                      ? `Parada #${stop.stopOrder}: ${cleanName} - Siguiente parada pendiente (Clic para vender)`
                      : `Parada #${stop.stopOrder}: ${cleanName} - Clic para registrar venta`;

                return (
                  <div key={stop.id || idx} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {/* Nodo de la parada interactivo */}
                    <Link
                      to={targetUrl}
                      className="seller-stop-node-link"
                      title={tooltipText}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: isAttendedSale ? '50%' : '8px',
                          background: isAttendedSale
                            ? '#64748b'
                            : isNoPurchase
                              ? '#f1f5f9'
                              : isNext
                                ? '#0284c7'
                                : isPostponed
                                  ? '#f59e0b'
                                  : '#f8fafc',
                          border: isAttendedSale
                            ? 'none'
                            : isNoPurchase
                              ? '1.5px dashed #94a3b8'
                              : isNext
                                ? '2px solid #0284c7'
                                : isPostponed
                                  ? 'none'
                                  : '1px solid #cbd5e1',
                          color: isAttendedSale
                            ? '#ffffff'
                            : isNoPurchase
                              ? '#64748b'
                              : (isNext || isPostponed)
                                ? '#ffffff'
                                : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          boxShadow: isNext ? '0 2px 6px rgba(2, 132, 199, 0.35)' : 'none'
                        }}
                      >
                        {isAttendedSale ? (
                          <Check size={16} strokeWidth={3} />
                        ) : isNoPurchase ? (
                          <X size={15} strokeWidth={2.5} />
                        ) : (
                          stop.stopOrder
                        )}
                      </div>
                    </Link>

                    {/* Línea conectora entre nodos */}
                    {!isLast && (
                      <div style={{
                        width: '20px',
                        height: '3px',
                        background: isAttendedSale ? '#94a3b8' : isNoPurchase ? '#cbd5e1' : '#e2e8f0',
                        margin: '0 4px',
                        flexShrink: 0
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sub-información de próxima parada con enlace directo a venta */}
            <div style={{
              marginTop: '0.35rem',
              paddingTop: '0.45rem',
              borderTop: '1px solid #f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.76rem'
            }}>
              {nextPendingStop ? (
                <Link
                  to={nextPendingStop.customerId ? `/sales?customerId=${encodeURIComponent(nextPendingStop.customerId)}&routeId=${encodeURIComponent(effectiveRouteId || '')}` : '/sales'}
                  style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
                  title={`Clic para registrar venta a ${cleanDisplayText(nextPendingStop.customerName)}`}
                >
                  <span style={{ color: '#0284c7', fontWeight: 800 }}>Próxima: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>#{nextPendingStop.stopOrder} {cleanDisplayText(nextPendingStop.customerName)}</span>
                </Link>
              ) : (
                <span style={{ color: '#059669', fontWeight: 700 }}>¡Recorrido completado!</span>
              )}
              <Link to="/loads" style={{ color: '#64748b', textDecoration: 'underline', fontSize: '0.72rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                Mapa GPS
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
            <span>Sin paradas registradas en esta ruta.</span>
            <div style={{ marginTop: '0.35rem' }}>
              <Link to="/loads" style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}>
                Consultar mapa de ruta →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Control de Envases/Garrafones (3 Columnas de la Maqueta) ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: '0.9rem 1rem',
        marginBottom: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        border: '1px solid #f1f5f9'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
            Control de Envases/Garrafones
          </h3>
          <Link to="/jugs" style={{ fontSize: '0.75rem', color: '#0284c7', textDecoration: 'none', fontWeight: 700 }}>
            Ver detalle →
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          textAlign: 'center',
          padding: '0.2rem 0'
        }}>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0891b2', fontFeatureSettings: '"tnum"', lineHeight: 1.1 }}>
              {jugsLoaded}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>
              cargados
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#059669', fontFeatureSettings: '"tnum"', lineHeight: 1.1 }}>
              {jugsEmptyRecovered}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>
              vacíos recogidos
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706', fontFeatureSettings: '"tnum"', lineHeight: 1.1 }}>
              {totalJugsLentOnRoute}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>
              pendientes
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Inventario en Camión (2 Columnas Exacto a la Maqueta) ─────── */}
      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', padding: '0 0.2rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
            Inventario en Camión
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {sellerLoad && (
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                Carga #{sellerLoad.loadNumber} ·
              </span>
            )}
            <Link to="/loads" style={{ fontSize: '0.75rem', color: '#0284c7', textDecoration: 'none', fontWeight: 700 }}>
              Ver cargas
            </Link>
          </div>
        </div>

        {isSettled ? (
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <CheckCircle2 size={24} style={{ color: '#059669', margin: '0 auto 0.35rem' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Jornada liquidada y conciliada</div>
            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>0 unidades activas en camión</div>
          </div>
        ) : isPendingReceipt ? (
          <div style={{ background: '#fffbeb', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #fef3c7' }}>
            <Package size={24} style={{ color: '#d97706', margin: '0 auto 0.35rem' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#92400e' }}>Carga lista para recibir</div>
            <p style={{ fontSize: '0.78rem', color: '#b45309', margin: '0.25rem 0 0.75rem' }}>
              Confirma la recepción física para subir las existencias a tu camión.
            </p>
            <button
              type="button"
              className="primary"
              disabled={isReceiving}
              onClick={() => void handleConfirmReceipt()}
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700 }}
            >
              {isReceiving ? (receiveProgress || 'Confirmando…') : 'Confirmar Recepción'}
            </button>
          </div>
        ) : truckItems.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.65rem'
          }}>
            {truckItems.map((item, idx) => {
              const itemPct = item.quantityBaseUnits > 0 
                ? Math.min(100, Math.round(((item.soldQty) / item.quantityBaseUnits) * 100))
                : 0;
              const barColor = idx % 2 === 0 ? '#0284c7' : '#059669';

              return (
                <div
                  key={item.id || idx}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '0.9rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <div style={{
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.productName}
                      </div>
                      {item.productCode && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                          {item.productCode}
                        </span>
                      )}
                    </div>

                    {/* Barra de progreso de ventas */}
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: '#e2e8f0',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      marginBottom: '0.65rem'
                    }}>
                      <div style={{
                        width: `${itemPct}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>

                  {/* Resumen 3 columnas: Cargado | Vendido | Restante */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    textAlign: 'center',
                    padding: '0.45rem 0.2rem',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Cargado</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                        {item.quantityBaseUnits}
                      </div>
                    </div>
                    <div style={{ borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.68rem', color: '#0284c7', fontWeight: 600 }}>Vendido</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7', fontFeatureSettings: '"tnum"' }}>
                        {item.soldQty}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: item.remainingOnTruck > 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>Restante</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: item.remainingOnTruck > 0 ? '#059669' : '#dc2626', fontFeatureSettings: '"tnum"' }}>
                        {item.remainingOnTruck}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', border: '1px solid #f1f5f9' }}>
            No hay existencias cargadas a bordo hoy.
          </div>
        )}
      </div>

      {/* ── 6. Últimas Ventas (Lista Limpia de la Maqueta) ───────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', padding: '0 0.2rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
            Últimas Ventas
          </h3>
          <Link to="/sales/list" style={{ fontSize: '0.75rem', color: '#0284c7', textDecoration: 'none', fontWeight: 700 }}>
            Ver todas ({sellerSales.length}) →
          </Link>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '0.2rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          border: '1px solid #f1f5f9'
        }}>
          {sellerSales.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem', color: '#64748b', fontSize: '0.82rem' }}>
              <p style={{ margin: '0 0 0.5rem' }}>Sin ventas registradas hoy en esta jornada.</p>
              <Link
                to="/sales"
                className="primary"
                style={{
                  display: 'inline-block',
                  padding: '0.4rem 0.95rem',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontWeight: 700
                }}
              >
                + Registrar primera venta
              </Link>
            </div>
          ) : (
            sellerSales.slice(0, 5).map((sale, i) => (
              <div
                key={sale.id || i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 0',
                  borderBottom: i < Math.min(sellerSales.length, 5) - 1 ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sale.customerName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>
                    {new Date(sale.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })} · Doc: {sale.documentNumber}
                  </div>
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                  {money(sale.total)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de confirmación de recepción exitosa */}
      {receiptSuccessModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem', zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px', maxWidth: '420px', width: '100%',
            padding: '1.75rem 1.5rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#ecfdf5', color: '#059669', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
            }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '1.25rem', fontWeight: 700 }}>
              ¡Carga #{receiptSuccessModal.loadNumber} Recibida!
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Se confirmó la recepción física a bordo del camión. Las existencias han sido cargadas a tu inventario y el recorrido de clientes ya está activo para registrar ventas.
            </p>
            <button
              type="button"
              className="primary"
              style={{ width: '100%', minHeight: '46px', fontSize: '0.95rem', fontWeight: 700, background: '#059669', borderColor: '#059669' }}
              onClick={() => {
                setReceiptSuccessModal(null);
                onRefresh();
              }}
            >
              Ver Existencias a Bordo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
