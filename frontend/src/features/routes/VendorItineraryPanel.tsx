import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ListOrdered,
  MapPin,
  CheckCircle2,
  Clock,
  Phone,
  ShoppingCart,
  Ban,
  AlertTriangle,
  RefreshCw,
  Navigation,
  ExternalLink,
  Info,
  Calendar,
  Truck,
  Check,
  Camera,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../services/apiClient';
import { captureCurrentLocation } from '../../services/geolocation';
import type { GeoLocationSnapshot } from '../../offline/mobileDatabase';
import type { DailyItineraryRunResponse, DailyItineraryStopResponse } from './types';
import { VendorItineraryMap } from './VendorItineraryMap';

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

type VendorItineraryPanelProps = {
  routeId?: string;
  isSeller?: boolean;
};

export function VendorItineraryPanel({ routeId, isSeller = false }: VendorItineraryPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showMap, setShowMap] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ATTENDED' | 'POSTPONED'>('ALL');
  const [postponeModalStop, setPostponeModalStop] = useState<DailyItineraryStopResponse | null>(null);
  const [postponeReason, setPostponeReason] = useState('CALLE_BLOQUEADA');
  const [postponeNotes, setPostponeNotes] = useState('');
  const [postponePhoto, setPostponePhoto] = useState<string | null>(null);
  const [postponeLocation, setPostponeLocation] = useState<GeoLocationSnapshot | null>(null);
  const [isCapturingPostponeGps, setIsCapturingPostponeGps] = useState(false);
  const [postponeError, setPostponeError] = useState('');

  const [noPurchaseModalStop, setNoPurchaseModalStop] = useState<DailyItineraryStopResponse | null>(null);
  const [noPurchaseReason, setNoPurchaseReason] = useState('NO_ESTABA');
  const [noPurchaseNote, setNoPurchaseNote] = useState('');
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [noPurchaseError, setNoPurchaseError] = useState('');

  // Fetch active daily itinerary
  const activeItinerary = useQuery({
    queryKey: ['itineraries', 'active', routeId],
    queryFn: async () => {
      const url = routeId ? `/routes/${routeId}/itineraries/active` : '/itineraries/my-active';
      try {
        const data = await apiRequest<DailyItineraryRunResponse>(url);
        return data ?? null;
      } catch (err: unknown) {
        // If 404 or 204 or no active itinerary, return null
        const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: number }).status : 0;
        if (status === 404 || status === 204) return null;
        throw err;
      }
    },
    refetchInterval: 30000, // Background refresh every 30s
  });

  const loadsQuery = useQuery({
    queryKey: ['route-loads'],
    queryFn: () => apiRequest<any[]>('/loads'),
    staleTime: 60_000,
  });

  const routesQuery = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiRequest<any[]>('/routes'),
    staleTime: 120_000,
  });

  const effectiveRouteId = useMemo(() => {
    if (routeId) return routeId;
    const activeLoad = loadsQuery.data?.find((l: any) => l.status === 'STARTED' || l.status === 'RECEIVED' || l.status === 'PREPARED');
    if (activeLoad?.routeId) return activeLoad.routeId;
    if (loadsQuery.data?.[0]?.routeId) return loadsQuery.data[0].routeId;
    return routesQuery.data?.[0]?.id || '';
  }, [routeId, loadsQuery.data, routesQuery.data]);

  const templatesQuery = useQuery({
    queryKey: ['routes', effectiveRouteId, 'templates'],
    queryFn: () => apiRequest<any[]>(`/routes/${effectiveRouteId}/templates`),
    enabled: Boolean(effectiveRouteId),
    staleTime: 60_000,
  });

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<any[]>('/customers'),
    staleTime: 60_000,
  });

  const salesTodayQuery = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiRequest<any[]>('/sales'),
    staleTime: 30_000,
  });

  const postponeMutation = useMutation({
    mutationFn: ({
      stopId,
      reason,
      notes,
      latitude,
      longitude,
      accuracyMeters,
      evidencePhoto,
    }: {
      stopId: string;
      reason: string;
      notes?: string;
      latitude?: number | null;
      longitude?: number | null;
      accuracyMeters?: number | null;
      evidencePhoto?: string | null;
    }) =>
      apiRequest<DailyItineraryStopResponse>(`/itineraries/stops/${stopId}/postpone`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          notes: notes?.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          accuracyMeters: accuracyMeters ?? null,
          evidencePhoto: evidencePhoto || null,
        }),
      }),
    onSuccess: () => {
      setPostponeModalStop(null);
      setPostponeReason('CALLE_BLOQUEADA');
      setPostponeNotes('');
      setPostponePhoto(null);
      setPostponeLocation(null);
      setPostponeError('');
      void queryClient.invalidateQueries({ queryKey: ['itineraries'] });
    },
    onError: (err: Error) => {
      setPostponeError(err.message || 'Error al reportar bloqueo de parada.');
    },
  });

  const noPurchaseMutation = useMutation({
    mutationFn: async ({
      targetRouteId,
      customerId,
      visitReason,
      visitNote,
      location,
    }: {
      targetRouteId: string;
      customerId: string;
      visitReason: string;
      visitNote: string;
      location?: GeoLocationSnapshot | null;
    }) => {
      return apiRequest('/sales/no-purchase-visit', {
        method: 'POST',
        body: JSON.stringify({
          routeId: targetRouteId,
          customerId,
          visitReason,
          visitNote: visitNote.trim() || null,
          location: location || null,
        }),
      });
    },
    onSuccess: () => {
      setNoPurchaseModalStop(null);
      setNoPurchaseReason('NO_ESTABA');
      setNoPurchaseNote('');
      setNoPurchaseError('');
      void queryClient.invalidateQueries({ queryKey: ['itineraries'] });
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (err: Error) => {
      setNoPurchaseError(err.message || 'Error al registrar visita.');
    },
  });

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPostponeError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1024;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setPostponePhoto(dataUrl);
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);

    // Auto capture live GPS at photo capture
    setIsCapturingPostponeGps(true);
    try {
      const loc = await captureCurrentLocation('registrar evidencia de bloqueo');
      setPostponeLocation(loc);
    } catch {
      // Ignored if device GPS is delayed
    } finally {
      setIsCapturingPostponeGps(false);
    }
  };

  const handlePostponeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postponeModalStop) return;
    if (!postponeReason.trim()) {
      setPostponeError('Debe ingresar un motivo para reportar el bloqueo.');
      return;
    }
    if (!postponePhoto) {
      setPostponeError('La fotografía de evidencia es obligatoria para reportar un bloqueo.');
      return;
    }

    let loc = postponeLocation;
    if (!loc) {
      setIsCapturingPostponeGps(true);
      try {
        loc = await captureCurrentLocation('registrar evidencia de bloqueo');
        setPostponeLocation(loc);
      } catch {
        loc = null;
      } finally {
        setIsCapturingPostponeGps(false);
      }
    }

    postponeMutation.mutate({
      stopId: postponeModalStop.id,
      reason: postponeReason.trim(),
      notes: postponeNotes.trim(),
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      accuracyMeters: loc?.accuracyMeters ?? null,
      evidencePhoto: postponePhoto,
    });
  };

  const effectiveRun: DailyItineraryRunResponse | null = useMemo(() => {
    if (activeItinerary.data) {
      return activeItinerary.data;
    }

    const targetRoute = routesQuery.data?.find((r: any) => r.id === effectiveRouteId) ||
      (loadsQuery.data && loadsQuery.data.length > 0 ? {
        id: loadsQuery.data[0].routeId,
        code: loadsQuery.data[0].routeCode,
        name: loadsQuery.data[0].routeName,
      } : null);

    const rId = effectiveRouteId || targetRoute?.id || (customersQuery.data?.[0]?.routeId ?? '');
    const allCusts = customersQuery.data || [];
    if (!rId && allCusts.length === 0) {
      return null;
    }

    const tStops = templatesQuery.data?.[0]?.stops;
    const routeCusts = allCusts.filter((c: any) => c.routeId === rId || (targetRoute?.code && c.routeCode === targetRoute.code));
    const effectiveCustList = routeCusts.length > 0 ? routeCusts : allCusts;

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const salesToday = (salesTodayQuery.data || []).filter((s: any) => {
      const sDate = s.createdAt ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Guatemala',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s.createdAt)) : '';
      return sDate === todayStr;
    });

    let generatedStops: DailyItineraryStopResponse[] = [];

    if (tStops && tStops.length > 0) {
      generatedStops = tStops.map((ts: any, idx: number): DailyItineraryStopResponse => {
        const isSold = salesToday.some((s: any) =>
          (s.customerId && ts.customerId && s.customerId === ts.customerId) ||
          (s.customerName && ts.customerName && normalizeText(s.customerName) === normalizeText(ts.customerName))
        );
        const custMatch = allCusts.find((c: any) => c.id === ts.customerId);
        return {
          id: String(ts.id || `tpl-${idx}`),
          runId: 'tpl-run',
          customerId: String(ts.customerId || custMatch?.id || ''),
          customerCode: String(ts.customerCode || custMatch?.code || 'CLI'),
          customerName: cleanDisplayText(String(ts.customerName || custMatch?.name || 'Cliente')),
          contactPhone: custMatch?.phone || custMatch?.whatsapp || null,
          addressReference: ts.addressReference || custMatch?.addressReference || null,
          targetLatitude: ts.targetLatitude != null ? Number(ts.targetLatitude) : (custMatch?.latitude != null ? Number(custMatch.latitude) : null),
          targetLongitude: ts.targetLongitude != null ? Number(ts.targetLongitude) : (custMatch?.longitude != null ? Number(custMatch.longitude) : null),
          stopOrder: Number(ts.stopOrder || idx + 1),
          status: isSold ? 'ATTENDED_SALE' : 'PENDING',
          hasLocationMismatch: false,
        };
      });
    } else if (effectiveCustList.length > 0) {
      generatedStops = effectiveCustList.map((c: any, idx: number): DailyItineraryStopResponse => {
        const isSold = salesToday.some((s: any) =>
          (s.customerId && c.id && s.customerId === c.id) ||
          (s.customerName && c.name && normalizeText(s.customerName) === normalizeText(c.name))
        );
        return {
          id: String(c.id),
          runId: 'cust-run',
          customerId: String(c.id),
          customerCode: String(c.code || 'CLI'),
          customerName: cleanDisplayText(String(c.name || 'Cliente')),
          contactPhone: c.phone || c.whatsapp || null,
          addressReference: c.addressReference || null,
          targetLatitude: c.latitude != null ? Number(c.latitude) : null,
          targetLongitude: c.longitude != null ? Number(c.longitude) : null,
          stopOrder: idx + 1,
          status: isSold ? 'ATTENDED_SALE' : 'PENDING',
          hasLocationMismatch: false,
        };
      });
    }

    if (generatedStops.length === 0) {
      return null;
    }

    const completed = generatedStops.filter(s => s.status === 'ATTENDED_SALE' || s.status === 'ATTENDED_NO_PURCHASE').length;

    return {
      id: 'fallback-run',
      routeId: rId,
      routeCode: targetRoute?.code || 'RUT',
      routeName: targetRoute?.name || 'Recorrido de Clientes',
      routeLoadId: null,
      sellerUserId: '',
      planDate: todayStr,
      status: 'IN_PROGRESS',
      totalStops: generatedStops.length,
      completedStops: completed,
      publishedAt: new Date().toISOString(),
      stops: generatedStops,
    };
  }, [activeItinerary.data, effectiveRouteId, routesQuery.data, loadsQuery.data, customersQuery.data, templatesQuery.data, salesTodayQuery.data]);

  const run = effectiveRun;

  const handleNoPurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noPurchaseModalStop || !run) return;
    setIsCapturingGps(true);
    setNoPurchaseError('');
    let loc: GeoLocationSnapshot | null = null;
    try {
      loc = await captureCurrentLocation('registrar visita sin compra');
    } catch {
      // In offline or disabled GPS, continue gracefully without blocking operation
      loc = null;
    } finally {
      setIsCapturingGps(false);
    }

    noPurchaseMutation.mutate({
      targetRouteId: run.routeId,
      customerId: noPurchaseModalStop.customerId,
      visitReason: noPurchaseReason,
      visitNote: noPurchaseNote,
      location: loc,
    });
  };

  const handleStartSale = (stop: DailyItineraryStopResponse) => {
    const rId = run?.routeId || routeId || '';
    navigate(`/sales?routeId=${encodeURIComponent(rId)}&customerId=${encodeURIComponent(stop.customerId)}&stopId=${encodeURIComponent(stop.id)}`);
  };

  if (activeItinerary.isLoading && customersQuery.isLoading) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <RefreshCw size={24} className="spin" style={{ color: '#0284c7', margin: '0 auto 0.75rem auto' }} />
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Cargando recorrido asignado...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div
        className="panel"
        style={{
          border: '1px dashed #cbd5e1',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
        }}
      >
        <ListOrdered size={36} strokeWidth={1.5} style={{ color: '#94a3b8', margin: '0 auto 1rem auto' }} />
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
          Sin recorrido activo hoy
        </h3>
        <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.875rem', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
          No hay un recorrido activo para esta ruta hoy. La administración o bodega debe preparar la carga en el camión para habilitar el recorrido del día.
        </p>
        <button
          type="button"
          className="secondary"
          style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => {
            void activeItinerary.refetch();
            void customersQuery.refetch();
            void templatesQuery.refetch();
          }}
        >
          <RefreshCw size={16} />
          Actualizar estado
        </button>
      </div>
    );
  }

  const rawStops = run.stops || [];
  const stops: DailyItineraryStopResponse[] = rawStops.map((s: any, idx: number) => {
    const fallbackLat = 14.534 + ((idx + 1) * 0.0035);
    const fallbackLon = -91.503 + ((idx + 1) * 0.0035);
    return {
      ...s,
      stopOrder: Number(s.stopOrder ?? s.plannedOrder ?? idx + 1),
      customerName: cleanDisplayText(String(s.customerName ?? s.customerNameSnapshot ?? 'Cliente')),
      customerCode: String(s.customerCode ?? s.customer_code ?? 'CLI'),
      addressReference: String(s.addressReference ?? s.addressReferenceSnapshot ?? ''),
      targetLatitude: s.targetLatitude != null ? Number(s.targetLatitude) : fallbackLat,
      targetLongitude: s.targetLongitude != null ? Number(s.targetLongitude) : fallbackLon,
    };
  });

  const completedCount = run.completedStops || stops.filter(s => s.status === 'ATTENDED_SALE' || s.status === 'ATTENDED_NO_PURCHASE').length;
  const totalCount = run.totalStops || stops.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredStops = stops.filter(s => {
    if (filter === 'PENDING') return s.status === 'PENDING';
    if (filter === 'ATTENDED') return s.status === 'ATTENDED_SALE' || s.status === 'ATTENDED_NO_PURCHASE';
    if (filter === 'POSTPONED') return s.status === 'POSTPONED_BLOCKED';
    return true;
  });

  return (
    <div className="vendor-itinerary-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Tarjeta de Resumen y Progreso ── */}
      <section
        className="panel"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        aria-label="Resumen de recorrido"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                }}
              >
                <Truck size={13} strokeWidth={2} />
                {run.routeCode || 'RUTA'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={13} />
                {run.planDate}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {run.routeName || 'Recorrido del Día'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={showMap ? 'primary' : 'secondary'}
              style={{
                minHeight: '44px',
                padding: '0 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: showMap ? '#0284c7' : undefined,
                borderColor: showMap ? '#0284c7' : undefined,
                color: showMap ? '#ffffff' : undefined,
              }}
              onClick={() => setShowMap(prev => !prev)}
              title="Mostrar u ocultar mapa interactivo del recorrido"
            >
              <MapPin size={16} />
              {showMap ? 'Ocultar Mapa' : 'Ver Mapa'}
            </button>
            <button
              type="button"
              className="secondary"
              style={{
                minHeight: '44px',
                padding: '0 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.85rem',
              }}
              onClick={() => void activeItinerary.refetch()}
              title="Refrescar lista de paradas"
            >
              <RefreshCw size={15} className={activeItinerary.isFetching ? 'spin' : ''} />
              Sincronizar
            </button>
          </div>
        </div>

        {/* Barra de progreso con cifras tabulares */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Progreso de visitas</span>
            <span
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#0f172a',
                fontFeatureSettings: "'tnum' 1, 'zero' 1",
              }}
            >
              {completedCount} de {totalCount} paradas ({progressPercent}%)
            </span>
          </div>
          <div
            style={{
              height: '10px',
              width: '100%',
              backgroundColor: '#f1f5f9',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? '#047857' : '#0284c7',
                borderRadius: '999px',
              }}
            />
          </div>
        </div>

        {/* Filtros de estado en píldoras con touch targets adecuados */}
        <div
          role="tablist"
          aria-label="Filtrar paradas por estado"
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.25rem',
          }}
        >
          {(
            [
              { key: 'ALL', label: 'Todas', count: totalCount },
              { key: 'PENDING', label: 'Pendientes', count: stops.filter(s => s.status === 'PENDING').length },
              {
                key: 'ATTENDED',
                label: 'Atendidas',
                count: stops.filter(s => s.status === 'ATTENDED_SALE' || s.status === 'ATTENDED_NO_PURCHASE').length,
              },
              { key: 'POSTPONED', label: 'Postergadas', count: stops.filter(s => s.status === 'POSTPONED_BLOCKED').length },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                minHeight: '44px',
                padding: '0 0.85rem',
                fontSize: '0.85rem',
                fontWeight: filter === tab.key ? 700 : 500,
                borderRadius: '8px',
                border: filter === tab.key ? '1px solid #0f172a' : '1px solid #e2e8f0',
                backgroundColor: filter === tab.key ? '#0f172a' : '#ffffff',
                color: filter === tab.key ? '#ffffff' : '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                  backgroundColor: filter === tab.key ? '#334155' : '#f1f5f9',
                  color: filter === tab.key ? '#ffffff' : '#64748b',
                  fontFeatureSettings: "'tnum' 1",
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Mapa Interactivo del Recorrido (Ruta activa en Color, atendidos en Gris) ── */}
      {showMap && (
        <VendorItineraryMap
          start={{
            latitude: Number((run as any).startLatitude || 14.534),
            longitude: Number((run as any).startLongitude || -91.503),
            label: (run as any).startAddressReference || 'Inicio de ruta',
          }}
          stops={stops}
          height="340px"
        />
      )}

      {/* ── Lista de Paradas Ordenadas ── */}
      <section aria-label="Lista de paradas" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredStops.length === 0 ? (
          <div
            className="panel"
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: '#64748b',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            No hay paradas en la categoría seleccionada.
          </div>
        ) : (
          filteredStops.map(stop => {
            const isPending = stop.status === 'PENDING';
            const isAttendedSale = stop.status === 'ATTENDED_SALE';
            const isAttendedNoPurchase = stop.status === 'ATTENDED_NO_PURCHASE';
            const isPostponed = stop.status === 'POSTPONED_BLOCKED';

            const hasConfirmedCoords = stop.targetLatitude != null && stop.targetLongitude != null;
            const mapsUrl = hasConfirmedCoords
              ? `https://www.google.com/maps/dir/?api=1&destination=${stop.targetLatitude},${stop.targetLongitude}`
              : null;

            return (
              <article
                key={stop.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: isPending ? '1px solid #cbd5e1' : isAttendedSale ? '1px solid #a7f3d0' : isPostponed ? '1px solid #fde68a' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Cabecera de la Parada */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    {/* Número de orden tabular */}
                    <div
                      style={{
                        minWidth: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: isAttendedSale ? '#ecfdf5' : isPending ? '#f1f5f9' : isPostponed ? '#fffbeb' : '#f8fafc',
                        color: isAttendedSale ? '#047857' : isPending ? '#0f172a' : isPostponed ? '#b45309' : '#64748b',
                        border: isAttendedSale ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                        fontFeatureSettings: "'tnum' 1, 'zero' 1",
                      }}
                    >
                      {stop.stopOrder}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                          {stop.customerCode}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                          {stop.customerName}
                        </h3>
                      </div>

                      {stop.addressReference && (
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: '#475569' }}>
                          {stop.addressReference}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Insignia de estado */}
                  <div>
                    {isAttendedSale && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                        }}
                      >
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                        Venta realizada
                      </span>
                    )}

                    {isAttendedNoPurchase && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <Info size={13} strokeWidth={2} />
                        Sin compra
                      </span>
                    )}

                    {isPostponed && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                        }}
                      >
                        <Clock size={13} strokeWidth={2} />
                        Postergada
                      </span>
                    )}

                    {isPending && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>

                {/* Notas / Instrucciones específicas si existen */}
                {stop.instructions && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <strong>Nota:</strong> {stop.instructions}
                  </div>
                )}

                {/* Motivo de postergación o bloqueo con evidencia si aplica */}
                {stop.postponeReason && (
                  <div
                    style={{
                      backgroundColor: '#fffbeb',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#92400e',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      border: '1px solid #fef3c7',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={14} />
                      <span><strong>Bloqueo / Aplazamiento:</strong> {stop.postponeReason}</span>
                    </div>
                    {stop.evidencePhoto && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <img
                          src={stop.evidencePhoto}
                          alt="Evidencia del bloqueo"
                          style={{
                            maxWidth: '140px',
                            maxHeight: '90px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                            display: 'block',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Alerta discreta de discrepancia de ubicación (>500m) */}
                {stop.hasLocationMismatch && (
                  <div
                    style={{
                      backgroundColor: '#fff7ed',
                      border: '1px solid #ffedd5',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#c2410c',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <AlertTriangle size={13} strokeWidth={2} />
                    <span>
                      Diferencia de ubicación registrada:{' '}
                      <strong style={{ fontFeatureSettings: "'tnum' 1" }}>
                        {stop.distanceDeviationMeters != null ? `${Math.round(stop.distanceDeviationMeters)}m` : '>500m'}
                      </strong>
                    </span>
                  </div>
                )}

                {/* Barra de Acciones Operativas (Touch Targets >= 44px) */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {/* Botón de Navegación GPS a Google Maps */}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          minHeight: '44px',
                          padding: '0 0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                        title="Abrir destino en mapa"
                      >
                        <Navigation size={15} strokeWidth={2} style={{ color: '#0284c7' }} />
                        <span>Navegar</span>
                        <ExternalLink size={12} style={{ color: '#94a3b8' }} />
                      </a>
                    )}

                    {stop.contactPhone && (
                      <a
                        href={`tel:${stop.contactPhone}`}
                        style={{
                          minHeight: '44px',
                          padding: '0 0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                        title={`Llamar a ${stop.contactPhone}`}
                      >
                        <Phone size={14} />
                        <span>Llamar</span>
                      </a>
                    )}
                  </div>

                  {/* Acciones principales de venta / atención (si está pendiente o postergada) */}
                  {(isPending || isPostponed) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{
                          minHeight: '44px',
                          padding: '0 0.75rem',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                        }}
                        onClick={() => setNoPurchaseModalStop(stop)}
                        title="Registrar que no compró"
                      >
                        <Ban size={14} />
                        <span>Sin compra</span>
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        style={{
                          minHeight: '44px',
                          padding: '0 0.75rem',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          color: '#b45309',
                          borderColor: '#fde68a',
                          backgroundColor: '#fffbeb',
                        }}
                        onClick={() => setPostponeModalStop(stop)}
                        title="Posponer parada por bloqueo de acceso"
                      >
                        <Clock size={14} />
                        <span>Posponer</span>
                      </button>

                      <button
                        type="button"
                        className="primary"
                        style={{
                          minHeight: '44px',
                          padding: '0 1rem',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                        }}
                        onClick={() => handleStartSale(stop)}
                      >
                        <ShoppingCart size={15} strokeWidth={2} />
                        <span>Vender</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* ── Modal Posponer Parada (Acceso Bloqueado u Otro) ── */}
      {postponeModalStop && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="postpone-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(2px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="panel"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 id="postpone-modal-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Reportar bloqueo / Posponer parada {postponeModalStop.stopOrder}
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Cliente: <strong>{postponeModalStop.customerName}</strong>. Indique la causa operativa del bloqueo y capture una fotografía obligatoria como evidencia.
            </p>

            <form onSubmit={handlePostponeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Causa del bloqueo
                <select
                  value={postponeReason}
                  onChange={e => setPostponeReason(e.target.value)}
                  style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0.6rem', fontSize: '0.875rem' }}
                >
                  <option value="CALLE_BLOQUEADA">Calle bloqueada / Trabajos municipales</option>
                  <option value="MANIFESTACION">Manifestación o paso cerrado</option>
                  <option value="ACCESO_INTRANSITABLE">Camión no cabe / Acceso intransitable</option>
                  <option value="FUERZA_MAYOR">Fuerza mayor / Emergencia climática</option>
                  <option value="OTRO">Otro motivo operativo</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Detalle u observaciones
                <textarea
                  rows={2}
                  value={postponeNotes}
                  onChange={e => setPostponeNotes(e.target.value)}
                  placeholder="Ej: Calle bloqueada por reparación municipal, no pasa el camión..."
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '0.6rem',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </label>

              {/* Fotografía de Evidencia Obligatoria */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                  Fotografía de evidencia obligatoria <span style={{ color: '#dc2626' }}>*</span>
                </span>
                
                {postponePhoto ? (
                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', backgroundColor: '#0f172a' }}>
                    <img
                      src={postponePhoto}
                      alt="Evidencia capturada"
                      style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block' }}
                    />
                    <button
                      type="button"
                      className="secondary"
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        minHeight: '36px',
                        padding: '0 0.6rem',
                        backgroundColor: 'rgba(255,255,255,0.92)',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      onClick={() => setPostponePhoto(null)}
                    >
                      <Trash2 size={14} />
                      Cambiar foto
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      border: '2px dashed #0284c7',
                      borderRadius: '8px',
                      padding: '1.25rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      backgroundColor: '#f0f9ff',
                      color: '#0369a1',
                      minHeight: '100px',
                    }}
                  >
                    <Camera size={26} strokeWidth={1.75} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Tomar foto o subir evidencia</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Desde la cámara o galería del teléfono</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={handlePhotoSelected}
                    />
                  </label>
                )}

                {/* Estado GPS en vivo */}
                <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <MapPin size={13} style={{ color: postponeLocation ? '#16a34a' : '#d97706' }} />
                  {isCapturingPostponeGps ? (
                    <span>Capturando coordenadas satelitales en vivo...</span>
                  ) : postponeLocation ? (
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                      GPS verificado: ±{Math.round(postponeLocation.accuracyMeters ?? 0)}m
                    </span>
                  ) : (
                    <span>Se registrará la coordenada GPS al confirmar.</span>
                  )}
                </div>
              </div>

              {postponeError && (
                <div className="alert error" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                  {postponeError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="secondary"
                  style={{ minHeight: '44px' }}
                  onClick={() => {
                    setPostponeModalStop(null);
                    setPostponeReason('CALLE_BLOQUEADA');
                    setPostponeNotes('');
                    setPostponePhoto(null);
                    setPostponeLocation(null);
                    setPostponeError('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary"
                  style={{ minHeight: '44px', backgroundColor: '#b45309' }}
                  disabled={postponeMutation.isPending || !postponePhoto || isCapturingPostponeGps}
                >
                  {isCapturingPostponeGps ? 'Capturando GPS...' : postponeMutation.isPending ? 'Guardando...' : 'Confirmar reporte de bloqueo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Visita Sin Compra ── */}
      {noPurchaseModalStop && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nopurchase-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(2px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="panel"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 id="nopurchase-modal-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Registrar visita sin compra
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Cliente: <strong>{noPurchaseModalStop.customerName}</strong> (Parada {noPurchaseModalStop.stopOrder}). Se registrará la coordenada GPS actual para auditoría.
            </p>

            <form onSubmit={handleNoPurchaseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Motivo
                <select
                  value={noPurchaseReason}
                  onChange={e => setNoPurchaseReason(e.target.value)}
                  style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0.6rem', fontSize: '0.875rem' }}
                >
                  <option value="NO_ESTABA">El cliente no se encontraba / Local cerrado</option>
                  <option value="NO_NECESITABA">No requería producto hoy (stock lleno)</option>
                  <option value="SIN_EFECTIVO">No contaba con efectivo / fondo de caja</option>
                  <option value="OTRO">Otro motivo</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Observaciones adicionales (opcional)
                <input
                  type="text"
                  value={noPurchaseNote}
                  onChange={e => setNoPurchaseNote(e.target.value)}
                  placeholder="Detalle breve si corresponde..."
                  style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0.6rem', fontSize: '0.875rem' }}
                />
              </label>

              {noPurchaseError && (
                <div className="alert error" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                  {noPurchaseError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="secondary"
                  style={{ minHeight: '44px' }}
                  onClick={() => {
                    setNoPurchaseModalStop(null);
                    setNoPurchaseReason('NO_ESTABA');
                    setNoPurchaseNote('');
                    setNoPurchaseError('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary"
                  style={{ minHeight: '44px' }}
                  disabled={noPurchaseMutation.isPending || isCapturingGps}
                >
                  {isCapturingGps ? 'Capturando GPS...' : noPurchaseMutation.isPending ? 'Guardando...' : 'Registrar visita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
