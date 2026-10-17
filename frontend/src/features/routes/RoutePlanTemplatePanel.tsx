import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../services/apiClient';
import {
  ListOrdered, Plus, ArrowUp, ArrowDown, MapPin, Send, CheckCircle2,
  AlertCircle, ShieldCheck, FileCheck, Layers, Zap, Compass, Sparkles, Loader2, History
} from 'lucide-react';

interface RouteOption {
  id: string;
  code: string;
  name: string;
}

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  addressReference: string;
  routeId?: string | null;
}

interface RouteTemplateStop {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  addressReference: string;
  targetLatitude: number;
  targetLongitude: number;
  stopOrder: number;
  instructions: string;
}

interface RouteTemplate {
  id: string;
  routeId: string;
  name: string;
  description: string;
  startLatitude: number;
  startLongitude: number;
  startAddressReference: string;
  version: number;
  status: string;
  stops: RouteTemplateStop[];
}

interface RouteLoadOption {
  id: string;
  loadNumber: number;
  routeId: string;
  status: string;
  loadType: string;
  plannedDate?: string;
}

interface Props {
  routes: RouteOption[];
  customers: CustomerOption[];
}

export function RoutePlanTemplatePanel({ routes, customers }: Props) {
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.id || '');
  const [templateName, setTemplateName] = useState<string>('Recorrido Habitual');
  const [startAddress, setStartAddress] = useState<string>('Bodega / Planta Central');
  const [startLat, setStartLat] = useState<string>('14.6349');
  const [startLon, setStartLon] = useState<string>('-90.5069');
  const [selectedCustomers, setSelectedCustomers] = useState<Array<{ customerId: string; instructions: string }>>([]);
  const [publishLoadId, setPublishLoadId] = useState<string>('');
  const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Queries
  const templatesQuery = useQuery({
    queryKey: ['route-templates', selectedRouteId],
    queryFn: () => selectedRouteId ? apiRequest<RouteTemplate[]>(`/routes/${selectedRouteId}/templates`) : Promise.resolve([]),
    enabled: !!selectedRouteId,
  });

  const loadsQuery = useQuery({
    queryKey: ['route-loads-available', selectedRouteId],
    queryFn: () => apiRequest<RouteLoadOption[]>('/loads'),
  });

  const activeItineraryQuery = useQuery({
    queryKey: ['active-itinerary', selectedRouteId],
    queryFn: () =>
      selectedRouteId
        ? apiRequest<{
            id: string;
            routeId: string;
            routeLoadId: string;
            loadNumber: number | string;
            status: string;
            totalPlannedStops: number;
            attendedStops: number;
            publishedAt: string;
          } | null>(`/routes/${selectedRouteId}/itineraries/active`)
        : Promise.resolve(null),
    enabled: !!selectedRouteId,
  });

  const salesOrderedQuery = useQuery({
    queryKey: ['sales-ordered-customers', selectedRouteId],
    queryFn: () =>
      selectedRouteId
        ? apiRequest<
            Array<{
              customerId: string;
              customerCode: string;
              customerName: string;
              addressReference: string;
              targetLatitude: number;
              targetLongitude: number;
              accuracyMeters: number;
              firstSaleAt: string | null;
              salesCount: number;
            }>
          >(`/routes/${selectedRouteId}/sales-ordered-customers`)
        : Promise.resolve([]),
    enabled: !!selectedRouteId,
  });

  // Auto-populate form when template loads
  useEffect(() => {
    if (templatesQuery.data && templatesQuery.data.length > 0) {
      const active = templatesQuery.data[0];
      setTemplateName(active.name);
      setStartAddress(active.startAddressReference);
      setStartLat(String(active.startLatitude));
      setStartLon(String(active.startLongitude));
      setSelectedCustomers(
        active.stops.map((s) => ({ customerId: s.customerId, instructions: s.instructions || '' }))
      );
    } else {
      setSelectedCustomers([]);
    }
  }, [templatesQuery.data, selectedRouteId]);

  const eligibleLoads = (loadsQuery.data || []).filter(
    (l) =>
      l.routeId === selectedRouteId &&
      (l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED' || l.status === 'RECEIVED' || l.status === 'STARTED')
  );

  // Route's customers
  const routeCustomers = customers.filter((c) => c.routeId === selectedRouteId);

  // Mutations
  const saveTemplateMutation = useMutation({
    mutationFn: (data: { name: string; startLatitude: number; startLongitude: number; startAddressReference: string; stops: Array<{ customerId: string; stopOrder: number; instructions: string }> }) =>
      apiRequest<RouteTemplate>(`/routes/${selectedRouteId}/templates`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Plantilla de recorrido guardada exitosamente.' });
      queryClient.invalidateQueries({ queryKey: ['route-templates', selectedRouteId] });
      setTimeout(() => setMessage(null), 4000);
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar plantilla' });
    },
  });

  const publishItineraryMutation = useMutation({
    mutationFn: (data: { routeLoadId: string }) =>
      apiRequest<{ id: string; totalPlannedStops: number; loadNumber?: number | string }>(
        `/routes/${selectedRouteId}/itineraries/publish`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (data) => {
      const stops = data?.totalPlannedStops ?? selectedCustomers.length;
      const loadNum = data?.loadNumber ? ` #${data.loadNumber}` : '';
      const text = `¡Acción confirmada! Recorrido enviado exitosamente al vendedor (Carga${loadNum} · ${stops} paradas listas).`;
      setPublishMessage({ type: 'success', text });
      setMessage({ type: 'success', text });
      queryClient.invalidateQueries({ queryKey: ['active-itinerary', selectedRouteId] });
      queryClient.invalidateQueries({ queryKey: ['itineraries'] });
    },
    onError: (err) => {
      const errorText = err instanceof Error ? err.message : 'Error al enviar el recorrido al vendedor';
      setPublishMessage({ type: 'error', text: errorText });
      setMessage({ type: 'error', text: errorText });
    },
  });

  const autoConfirmMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ autoConfirmed: number; alreadyHadLocation: number; noHistoricalData: number }>(
        `/routes/${selectedRouteId}/auto-confirm-locations`,
        { method: 'POST' }
      ),
    onSuccess: (data) => {
      setMessage({
        type: 'success',
        text: `Detección automática completada: ${data.autoConfirmed} ubicaciones confirmadas desde ventas previas (${data.alreadyHadLocation} ya estaban confirmadas).`
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['route-templates'] });
      setTimeout(() => setMessage(null), 6000);
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error en auto-detección de ubicaciones' });
    }
  });

  const handleAddAllRouteCustomers = () => {
    const existing = new Set(selectedCustomers.map((c) => c.customerId));
    const toAdd = routeCustomers.filter((c) => !existing.has(c.id)).map((c) => ({ customerId: c.id, instructions: '' }));
    setSelectedCustomers([...selectedCustomers, ...toAdd]);
  };

  const handleOptimizeRouteOrder = () => {
    if (selectedCustomers.length <= 1) return;
    const originLat = Number(startLat) || 14.6349;
    const originLon = Number(startLon) || -90.5069;

    const dist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const currentTemplate = templatesQuery.data?.[0];
    const locMap = new Map<string, { lat: number; lon: number }>();
    if (currentTemplate) {
      for (const stop of currentTemplate.stops) {
        if (stop.targetLatitude && stop.targetLongitude) {
          locMap.set(stop.customerId, { lat: stop.targetLatitude, lon: stop.targetLongitude });
        }
      }
    }

    const unvisited = [...selectedCustomers];
    const ordered: typeof selectedCustomers = [];
    let currentLat = originLat;
    let currentLon = originLon;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const item = unvisited[i];
        const loc = locMap.get(item.customerId);
        const d = loc ? dist(currentLat, currentLon, loc.lat, loc.lon) : 9999999 + i;
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = i;
        }
      }

      const next = unvisited.splice(nearestIdx, 1)[0];
      ordered.push(next);
      const nextLoc = locMap.get(next.customerId);
      if (nextLoc) {
        currentLat = nextLoc.lat;
        currentLon = nextLoc.lon;
      }
    }

    setSelectedCustomers(ordered);
    setMessage({
      type: 'success',
      text: 'Recorrido optimizado automáticamente por proximidad geográfica desde la Bodega Central.'
    });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleOrderBySalesHistory = () => {
    const historyList = salesOrderedQuery.data || [];
    if (!historyList.length) {
      if (!routeCustomers.length) {
        setMessage({ type: 'error', text: 'No se encontraron clientes asignados a esta ruta.' });
        setTimeout(() => setMessage(null), 4000);
        return;
      }
      setSelectedCustomers(routeCustomers.map((c) => ({ customerId: c.id, instructions: '' })));
      return;
    }

    const orderMap = new Map<string, number>();
    historyList.forEach((item, index) => {
      orderMap.set(item.customerId, index);
    });

    if (selectedCustomers.length === 0) {
      setSelectedCustomers(historyList.map(item => ({ customerId: item.customerId, instructions: '' })));
    } else {
      const sorted = [...selectedCustomers].sort((a, b) => {
        const orderA = orderMap.has(a.customerId) ? orderMap.get(a.customerId)! : 999999;
        const orderB = orderMap.has(b.customerId) ? orderMap.get(b.customerId)! : 999999;
        return orderA - orderB;
      });
      setSelectedCustomers(sorted);
    }

    const soldCount = historyList.filter(c => c.firstSaleAt).length;
    setMessage({
      type: 'success',
      text: `Secuencia ordenada en base a historial: desde la primera venta hasta la última (${soldCount} clientes con ventas previas).`,
    });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAutoBuildFullRoute = () => {
    const historyList = salesOrderedQuery.data || [];
    if (historyList.length > 0) {
      setSelectedCustomers(historyList.map((c) => ({ customerId: c.customerId, instructions: '' })));
      const soldCount = historyList.filter(c => c.firstSaleAt).length;
      setMessage({
        type: 'success',
        text: `Se cargaron los ${historyList.length} clientes ordenados cronológicamente desde la 1ª venta hasta la última (${soldCount} con ventas registradas).`,
      });
      setTimeout(() => setMessage(null), 5000);
    } else {
      const toAdd = routeCustomers.map((c) => ({ customerId: c.id, instructions: '' }));
      if (!toAdd.length) {
        setMessage({ type: 'error', text: 'No hay clientes asignados a esta ruta para ordenar.' });
        return;
      }
      setSelectedCustomers(toAdd);
      setMessage({
        type: 'success',
        text: `Se agregaron los ${toAdd.length} clientes de la ruta.`,
      });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const items = [...selectedCustomers];
    const temp = items[index - 1];
    items[index - 1] = items[index];
    items[index] = temp;
    setSelectedCustomers(items);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedCustomers.length - 1) return;
    const items = [...selectedCustomers];
    const temp = items[index + 1];
    items[index + 1] = items[index];
    items[index] = temp;
    setSelectedCustomers(items);
  };

  const handleRemove = (index: number) => {
    setSelectedCustomers(selectedCustomers.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomers.length) {
      setMessage({ type: 'error', text: 'Debe agregar al menos un cliente al recorrido ordenado.' });
      return;
    }
    const lat = Number(startLat);
    const lon = Number(startLon);
    if (isNaN(lat) || isNaN(lon)) {
      setMessage({ type: 'error', text: 'Coordenadas de inicio inválidas.' });
      return;
    }

    saveTemplateMutation.mutate({
      name: templateName.trim(),
      startLatitude: lat,
      startLongitude: lon,
      startAddressReference: startAddress.trim(),
      stops: selectedCustomers.map((c, idx) => ({
        customerId: c.customerId,
        stopOrder: idx + 1,
        instructions: c.instructions,
      })),
    });
  };

  const handlePublish = () => {
    if (!publishLoadId) {
      setPublishMessage({ type: 'error', text: 'Seleccione una carga activa para enviar el recorrido.' });
      return;
    }
    setPublishMessage(null);
    publishItineraryMutation.mutate({ routeLoadId: publishLoadId });
  };

  return (
    <div className="surface" style={{ padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListOrdered size={20} style={{ color: '#0284c7' }} /> Plantilla de Recorrido y Orden de Clientes
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Defina el orden secuencial (1..N) y punto de inicio para la jornada de entrega de agua pura.
          </p>
        </div>

        {/* Route selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Ruta:</label>
          <select
            value={selectedRouteId}
            onChange={(e) => {
              setSelectedRouteId(e.target.value);
              setSelectedCustomers([]);
            }}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} - {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem',
          background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#047857' : '#b91c1c', fontSize: '0.85rem'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Template metadata & Start Location */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Nombre de plantilla
            </label>
            <input
              type="text"
              required
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ej. Recorrido Lunes"
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Punto de Partida
            </label>
            <input
              type="text"
              required
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
              placeholder="Ej. Bodega / Planta Central"
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Latitud de Partida
            </label>
            <input
              type="number"
              step="any"
              required
              value={startLat}
              onChange={(e) => setStartLat(e.target.value)}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFeatureSettings: '"tnum"' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Longitud de Partida
            </label>
            <input
              type="number"
              step="any"
              required
              value={startLon}
              onChange={(e) => setStartLon(e.target.value)}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFeatureSettings: '"tnum"' }}
            />
          </div>
        </div>

        {/* Stops Ordering Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} /> Paradas Planificadas ({selectedCustomers.length} clientes en secuencia)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="secondary"
                disabled={salesOrderedQuery.isLoading}
                onClick={handleOrderBySalesHistory}
                title="Ordena los clientes en base al registro cronológico de ventas, desde la 1ª venta hasta la última registrada"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', minHeight: '36px', display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#166534', fontWeight: 600 }}
              >
                {salesOrderedQuery.isLoading ? <Loader2 size={14} className="spin" /> : <History size={14} style={{ color: '#16a34a' }} />}
                Ordenar por Historial de Ventas (1ª a Última)
              </button>

              <button
                type="button"
                className="secondary"
                disabled={autoConfirmMutation.isPending}
                onClick={() => autoConfirmMutation.mutate()}
                title="Detecta automáticamente coordenadas desde las ventas previas de los clientes de esta ruta"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', minHeight: '36px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                {autoConfirmMutation.isPending ? <Loader2 size={14} className="spin" /> : <Zap size={14} style={{ color: '#d97706' }} />}
                Auto-Detectar GPS ({routeCustomers.length})
              </button>

              <button
                type="button"
                className="secondary"
                disabled={selectedCustomers.length <= 1}
                onClick={handleOptimizeRouteOrder}
                title="Calcula automáticamente el orden secuencial más corto desde la bodega por proximidad geográfica"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', minHeight: '36px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Compass size={14} style={{ color: '#0284c7' }} />
                Optimizar Orden Geográfico
              </button>

              <button
                type="button"
                className="secondary"
                onClick={handleAutoBuildFullRoute}
                title="Carga todos los clientes de la ruta ordenados cronológicamente desde la 1ª a la última venta"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', minHeight: '36px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
              >
                <Sparkles size={14} style={{ color: '#7c3aed' }} />
                1-Clic: Cargar y Ordenar Todo
              </button>
            </div>
          </div>

          {!selectedCustomers.length ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Aún no ha añadido clientes a este recorrido. Utilice el botón superior para cargar clientes de la ruta.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '380px', overflowY: 'auto' }}>
              {selectedCustomers.map((item, idx) => {
                const cust = customers.find((c) => c.id === item.customerId);
                return (
                  <div
                    key={item.customerId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem'
                    }}
                  >
                    {/* Order Badge */}
                    <div style={{
                      minWidth: '28px', height: '28px', borderRadius: '50%', background: '#0284c7', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem',
                      fontFeatureSettings: '"tnum"'
                    }}>
                      {idx + 1}
                    </div>

                    {/* Customer Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {cust?.name || 'Cliente'} <span className="muted" style={{ fontWeight: 400, fontSize: '0.75rem' }}>({cust?.code})</span>
                      </div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        {cust?.addressReference || 'Sin referencia'}
                      </div>
                    </div>

                    {/* Instructions */}
                    <input
                      type="text"
                      placeholder="Instrucción de parada (opcional)"
                      value={item.instructions}
                      onChange={(e) => {
                        const updated = [...selectedCustomers];
                        updated[idx].instructions = e.target.value;
                        setSelectedCustomers(updated);
                      }}
                      style={{ maxWidth: '200px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />

                    {/* Move Controls */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        style={{ padding: '4px 8px', minHeight: '32px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                        title="Subir orden"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === selectedCustomers.length - 1}
                        style={{ padding: '4px 8px', minHeight: '32px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: idx === selectedCustomers.length - 1 ? 'not-allowed' : 'pointer' }}
                        title="Bajar orden"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        style={{ padding: '4px 8px', minHeight: '32px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="submit"
            className="primary"
            disabled={saveTemplateMutation.isPending || !selectedCustomers.length}
            style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileCheck size={16} />
            {saveTemplateMutation.isPending ? 'Guardando...' : 'Guardar Plantilla Maestra'}
          </button>
        </div>
      </form>

      {/* Recorrido del Día para el Vendedor */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Send size={16} style={{ color: '#059669' }} /> Recorrido del Día para el Vendedor (Lista de Clientes)
        </h3>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
          Envía la lista ordenada de clientes y sus coordenadas al teléfono móvil del chofer o vendedor para su jornada.
        </p>

        <div style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.5rem 0.75rem', lineHeight: 1.5 }}>
          <strong>¿Este paso es obligatorio?</strong> No, es 100% automatizado. Cuando el chofer pulsa <strong>&quot;Aceptar Carga&quot;</strong> en su teléfono, el sistema le asigna y envía esta lista de clientes de inmediato. Este botón te permite enviársela o actualizársela anticipadamente si lo deseas.
        </div>

        {/* Estado actual de publicación en el vendedor */}
        {activeItineraryQuery.data && (
          <div style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px',
            padding: '0.6rem 0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#065f46' }}>
              <strong>Recorrido activo y enviado:</strong> La Carga #{activeItineraryQuery.data.loadNumber} ya tiene {activeItineraryQuery.data.totalPlannedStops} paradas asignadas al vendedor ({activeItineraryQuery.data.status === 'PUBLISHED' ? 'Listo en el teléfono del piloto' : 'En recorrido'}).
            </div>
          </div>
        )}

        {/* Mensaje de confirmación visible para el usuario */}
        {publishMessage && (
          <div
            role="alert"
            style={{
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '0.7rem 0.9rem',
              borderRadius: '6px',
              background: publishMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${publishMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              color: publishMessage.type === 'success' ? '#047857' : '#b91c1c',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {publishMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{publishMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setPublishMessage(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, padding: '0 4px' }}
              title="Cerrar mensaje"
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={publishLoadId}
            onChange={(e) => setPublishLoadId(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', minWidth: '280px' }}
          >
            <option value="">
              {eligibleLoads.length === 0
                ? '-- No hay cargas activas para esta ruta (prepare una en Cargas) --'
                : '-- Seleccionar Carga Activa --'}
            </option>
            {eligibleLoads.map((l) => {
              const statusEs =
                l.status === 'PREPARED'
                  ? 'Preparada'
                  : l.status === 'WAREHOUSE_CONFIRMED'
                  ? 'Confirmada bodega'
                  : l.status === 'RECEIVED'
                  ? 'Recibida vendedor'
                  : l.status === 'STARTED'
                  ? 'En recorrido'
                  : l.status;
              const isAlreadyPublished = activeItineraryQuery.data?.routeLoadId === l.id;
              const dateStr = l.plannedDate ? ` · ${l.plannedDate}` : '';
              const publishedTag = isAlreadyPublished ? ' [Ya enviada]' : '';
              return (
                <option key={l.id} value={l.id}>
                  Carga #{l.loadNumber}{dateStr} ({statusEs}){publishedTag}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="primary"
            disabled={!publishLoadId || publishItineraryMutation.isPending}
            onClick={handlePublish}
            style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '6px', background: '#059669', borderColor: '#059669' }}
          >
            {publishItineraryMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando al vendedor...
              </>
            ) : (
              <>
                <Send size={16} />
                {activeItineraryQuery.data?.routeLoadId === publishLoadId
                  ? 'Actualizar Lista al Vendedor'
                  : 'Enviar Lista al Vendedor'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
