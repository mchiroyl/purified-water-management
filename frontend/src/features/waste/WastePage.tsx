import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';
import { queueWaste } from './wasteOffline';

type Route = { id: string; code: string; name: string; status: string; sellerId?: string; sellerName?: string };
type Presentation = { id: string; code: string; name: string; conversionFactor: number; active: boolean };
type Product = { id: string; code: string; name: string; active: boolean; controlsInventory: boolean; presentations: Presentation[] };
type WasteType = { id: string; code: string; name: string; evidencePolicy: string; warehouseApprovalLimitBaseUnits: number; supervisorApprovalLimitBaseUnits: number; dailyAlertThreshold: number; active: boolean };
type WasteItem = { id: string; wasteTypeName: string; presentationName: string; productName: string; reportedBaseUnits: number; recoverableBaseUnits: number; approvedBaseUnits: number };
type Waste = { id: string; routeCode: string; routeName: string; sellerName: string; status: string; requiredRole?: string | null; reason: string; reportedBaseUnits: number; approvedBaseUnits: number; pendingDifferenceBaseUnits: number; occurredAtLocal: string; items: WasteItem[]; evidence: unknown[]; reviews: unknown[] };
type Indicator = { sellerId: string; sellerName: string; routeId: string; routeName: string; productId: string; productName: string; reportCount: number; reportedBaseUnits: number; approvedBaseUnits: number; openAlerts: number };

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Pendiente de revisión', PENDING_SECOND_APPROVAL: 'Pendiente de segunda aprobación',
  APPROVED: 'Aprobada', PARTIALLY_APPROVED: 'Aprobada parcialmente', REJECTED: 'Rechazada',
};

export function WastePage({ canReport, canReview, canManageCatalog, deviceId }: {
  canReport: boolean; canReview: boolean; canManageCatalog: boolean; deviceId: string;
}) {
  const queryClient = useQueryClient();
  const wastes = useQuery({ queryKey: ['wastes'], queryFn: () => apiRequest<Waste[]>('/wastes') });
  const types = useQuery({ queryKey: ['waste-types'], queryFn: () => apiRequest<WasteType[]>('/wastes/types') });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canReport });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canReport });
  const indicators = useQuery({ queryKey: ['waste-indicators'], queryFn: () => apiRequest<Indicator[]>('/wastes/indicators'), enabled: canReview });
  const [routeId, setRouteId] = useState('');
  const [wasteTypeId, setWasteTypeId] = useState('');
  const [presentationId, setPresentationId] = useState('');
  const [presentationQuantity, setPresentationQuantity] = useState(1);
  const [reportedDamagedUnits, setReportedDamagedUnits] = useState(1);
  const [recoverableUnits, setRecoverableUnits] = useState(0);
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [localMessage, setLocalMessage] = useState('');
  const [localReports, setLocalReports] = useState<Array<{ id: string; reason: string }>>([]);
  const [approved, setApproved] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState({ code: '', name: '', evidencePolicy: 'RECOMMENDED', warehouseApprovalLimitBaseUnits: '5', supervisorApprovalLimitBaseUnits: '20', dailyAlertThreshold: '3' });

  const presentations = useMemo(() => products.data?.filter(product => product.active && product.controlsInventory)
    .flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, product }))) ?? [], [products.data]);
  const selectedRoute = routes.data?.find(route => route.id === routeId);
  const selectedType = types.data?.find(type => type.id === wasteTypeId);

  async function saveOffline(event: FormEvent) {
    event.preventDefault();
    if (!selectedRoute?.sellerId) { setLocalMessage('La ruta necesita un vendedor asignado.'); return; }
    try {
      const waste = await queueWaste({ routeId, sellerId: selectedRoute.sellerId, deviceId, wasteTypeId,
        presentationId, presentationQuantity, reportedDamagedUnits, recoverableUnits, reason, photo });
      setLocalReports(current => [{ id: waste.localWasteId, reason: waste.reason }, ...current]);
      setReason(''); setPhoto(null); setLocalMessage('Merma guardada en el teléfono y pendiente de sincronización.');
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : 'No fue posible guardar la merma.');
    }
  }

  const review = useMutation({
    mutationFn: ({ waste, decision }: { waste: Waste; decision: 'APPROVE' | 'REJECT' }) => apiRequest<Waste>(`/wastes/${waste.id}/reviews`, {
      method: 'POST', body: JSON.stringify({ decision, notes: reviewNotes[waste.id] || (decision === 'REJECT' ? 'Merma no comprobada' : 'Daño físico comprobado'),
        items: waste.items.map(item => ({ itemId: item.id, approvedBaseUnits: decision === 'REJECT' ? 0 : Number(approved[item.id] ?? item.reportedBaseUnits) })) }),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['wastes'] }); await queryClient.invalidateQueries({ queryKey: ['inventory'] }); await queryClient.invalidateQueries({ queryKey: ['waste-indicators'] }); },
  });
  const saveType = useMutation({
    mutationFn: () => apiRequest<WasteType>('/wastes/types', { method: 'POST', body: JSON.stringify({
      ...catalog, warehouseApprovalLimitBaseUnits: Number(catalog.warehouseApprovalLimitBaseUnits),
      supervisorApprovalLimitBaseUnits: Number(catalog.supervisorApprovalLimitBaseUnits),
      dailyAlertThreshold: Number(catalog.dailyAlertThreshold), active: true,
    }) }),
    onSuccess: async () => { setCatalog(current => ({ ...current, code: '', name: '' })); await queryClient.invalidateQueries({ queryKey: ['waste-types'] }); },
  });

  return <main>
    <p className="eyebrow">Control físico</p>
    <h1>Mermas</h1>
    <p className="muted">Registra producto dañado en unidades base. Solo la cantidad aprobada afecta inventario; ventas y pagos permanecen intactos.</p>

    {canReport && <form className="panel section-panel" onSubmit={saveOffline}>
      <h2>Reportar pérdida física</h2>
      <div className="form-grid compact-grid">
        <label>Ruta<select required value={routeId} onChange={event => setRouteId(event.target.value)}><option value="">Seleccionar</option>{routes.data?.filter(route => route.status === 'ACTIVE').map(route => <option key={route.id} value={route.id}>{route.code} · {route.name}</option>)}</select></label>
        <label>Tipo de merma<select required value={wasteTypeId} onChange={event => setWasteTypeId(event.target.value)}><option value="">Seleccionar</option>{types.data?.filter(type => type.active).map(type => <option key={type.id} value={type.id}>{type.name} · evidencia {type.evidencePolicy === 'REQUIRED' ? 'requerida' : type.evidencePolicy === 'RECOMMENDED' ? 'recomendada' : 'no requerida'}</option>)}</select></label>
        <label>Presentación<select required value={presentationId} onChange={event => setPresentationId(event.target.value)}><option value="">Seleccionar</option>{presentations.map(item => <option key={item.id} value={item.id}>{item.product.name} · {item.name} · {Number(item.conversionFactor)} unidades</option>)}</select></label>
        <label>Presentaciones afectadas<input required type="number" min="0.0001" step="0.0001" value={presentationQuantity} onChange={event => setPresentationQuantity(Number(event.target.value))} /></label>
        <label>Unidades dañadas<input required type="number" min="0.0001" step="0.0001" value={reportedDamagedUnits} onChange={event => setReportedDamagedUnits(Number(event.target.value))} /></label>
        <label>Unidades recuperables<input required type="number" min="0" step="0.0001" value={recoverableUnits} onChange={event => setRecoverableUnits(Number(event.target.value))} /></label>
        <label className="full-width">Motivo<textarea required value={reason} onChange={event => setReason(event.target.value)} /></label>
        <label className="full-width">Fotografía {selectedType?.evidencePolicy === 'REQUIRED' ? '(requerida)' : '(opcional)'}<input required={selectedType?.evidencePolicy === 'REQUIRED'} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => setPhoto(event.target.files?.[0] ?? null)} /></label>
      </div>
      <div className="form-actions"><button className="primary">Guardar offline</button></div>
      {localMessage && <div className="alert">{localMessage}</div>}
      {localReports.map(item => <p className="status-note" key={item.id}>{item.reason} · LOCAL_PENDING</p>)}
    </form>}

    {canManageCatalog && <form className="panel section-panel" onSubmit={event => { event.preventDefault(); saveType.mutate(); }}>
      <h2>Catálogo y políticas de merma</h2>
      <div className="form-grid compact-grid">
        <label>Código<input required value={catalog.code} onChange={event => setCatalog(current => ({ ...current, code: event.target.value }))} /></label>
        <label>Nombre<input required value={catalog.name} onChange={event => setCatalog(current => ({ ...current, name: event.target.value }))} /></label>
        <label>Evidencia<select value={catalog.evidencePolicy} onChange={event => setCatalog(current => ({ ...current, evidencePolicy: event.target.value }))}><option value="REQUIRED">Requerida</option><option value="RECOMMENDED">Recomendada</option><option value="NONE">No requerida</option></select></label>
        <label>Límite bodega<input type="number" min="0" step="0.0001" value={catalog.warehouseApprovalLimitBaseUnits} onChange={event => setCatalog(current => ({ ...current, warehouseApprovalLimitBaseUnits: event.target.value }))} /></label>
        <label>Límite supervisor<input type="number" min="0" step="0.0001" value={catalog.supervisorApprovalLimitBaseUnits} onChange={event => setCatalog(current => ({ ...current, supervisorApprovalLimitBaseUnits: event.target.value }))} /></label>
        <label>Alerta por reportes diarios<input type="number" min="1" value={catalog.dailyAlertThreshold} onChange={event => setCatalog(current => ({ ...current, dailyAlertThreshold: event.target.value }))} /></label>
      </div><button className="primary" disabled={saveType.isPending}>Guardar tipo</button>
    </form>}

    {canReview && <section className="section-panel">
      <div className="section-heading"><h2>Indicadores para investigación</h2><span>{indicators.data?.reduce((sum, item) => sum + Number(item.openAlerts), 0) ?? 0} alertas abiertas</span></div>
      <div className="data-list">{indicators.data?.map(item => <div className="data-row" key={`${item.sellerId}:${item.routeId}:${item.productId}`}><span>{item.sellerName} · {item.routeName} · {item.productName}</span><strong>{item.reportCount} reportes · {Number(item.reportedBaseUnits)} unidades</strong></div>)}</div>
    </section>}

    <section className="section-panel">
      <div className="section-heading"><h2>Reportes de merma</h2><span>{wastes.data?.length ?? 0}</span></div>
      {wastes.error && <div className="alert error">{wastes.error.message}</div>}
      <div className="sales-grid">{wastes.data?.map(waste => <article className="panel sale-card" key={waste.id}>
        <div className="section-heading"><div><strong>{waste.routeCode} · {waste.routeName}</strong><span>{waste.sellerName}</span></div><span className="status-pill">{statusLabel[waste.status] ?? waste.status}</span></div>
        <p>{waste.reason}</p>
        {waste.items.map(item => <div className="data-row" key={item.id}><span>{item.productName} · {item.presentationName} · {item.wasteTypeName}</span><strong>Dañadas {Number(item.reportedBaseUnits)} · recuperables {Number(item.recoverableBaseUnits)}</strong></div>)}
        <p className="status-note">Aprobadas: {Number(waste.approvedBaseUnits)} · Diferencia pendiente: {Number(waste.pendingDifferenceBaseUnits)}</p>
        {waste.requiredRole && <p className="status-note">Segunda aprobación requerida: {waste.requiredRole}</p>}
        {canReview && ['PENDING_REVIEW', 'PENDING_SECOND_APPROVAL'].includes(waste.status) && <div className="review-box">
          {waste.items.map(item => <label key={item.id}>Aprobar unidades de {item.productName}<input type="number" min="0" max={item.reportedBaseUnits} step="0.0001" value={approved[item.id] ?? String(item.reportedBaseUnits)} onChange={event => setApproved(current => ({ ...current, [item.id]: event.target.value }))} /></label>)}
          <label>Notas<input value={reviewNotes[waste.id] ?? ''} onChange={event => setReviewNotes(current => ({ ...current, [waste.id]: event.target.value }))} /></label>
          <div className="form-actions"><button className="secondary" onClick={() => review.mutate({ waste, decision: 'REJECT' })}>Rechazar</button><button className="primary" onClick={() => review.mutate({ waste, decision: 'APPROVE' })}>Aprobar cantidades</button></div>
        </div>}
      </article>)}</div>
    </section>
  </main>;
}
