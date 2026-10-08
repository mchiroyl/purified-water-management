import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../app/PageHeader';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';
import { calendarOnlyProps, currentMonthDateTimeBounds } from '../../utils/dateInput';

type Authorization = {
  id: string;
  authorizationType: string;
  entityType: string;
  entityId: string;
  requestedByUsername: string;
  reason: string;
  status: string;
  expiresAt: string;
  decidedByUsername?: string;
  decisionNotes?: string;
};

type Incident = {
  id: string;
  routeCode?: string;
  routeName?: string;
  incidentType: string;
  severity: string;
  status: string;
  description: string;
  reportedByUsername: string;
  handledByUsername?: string;
  resolutionNotes?: string;
};

type Route = { id: string; code: string; name: string; status: string };

type SettlementSummary = {
  id: string;
  routeLoadId: string;
  loadNumber: string;
  routeName: string;
  sellerName: string;
  status: string;
  monetaryDifference: number;
};

const authorizationStatusLabels: Record<string, string> = {
  REQUESTED: 'Solicitud pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
};

const authorizationTypeLabels: Record<string, string> = {
  SETTLEMENT_DIFFERENCE: 'Liquidación con diferencia',
  LOAD_CORRECTION: 'Corrección de carga',
  CREDIT_LIMIT_CHANGE: 'Cambio de límite',
  OTHER_OPERATION: 'Otra excepción operativa',
};

const incidentLabels: Record<string, string> = {
  OPEN: 'Incidencia abierta',
  INVESTIGATING: 'En investigación',
  RESOLVED: 'Resuelta',
  DISMISSED: 'Descartada',
};

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

export function OperationsControlPage({ canDecide }: { canDecide: boolean }) {
  const dateBounds = currentMonthDateTimeBounds();
  const client = useQueryClient();

  const authorizations = useQuery({
    queryKey: ['operations-control', 'authorizations'],
    queryFn: () => apiRequest<Authorization[]>('/operations-control/authorizations'),
  });

  const incidents = useQuery({
    queryKey: ['operations-control', 'incidents'],
    queryFn: () => apiRequest<Incident[]>('/operations-control/incidents'),
  });

  const routes = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiRequest<Route[]>('/routes'),
  });

  const settlements = useQuery({
    queryKey: ['settlements'],
    queryFn: () => apiRequest<SettlementSummary[]>('/settlements'),
  });

  const [authorization, setAuthorization] = useState({
    authorizationType: 'SETTLEMENT_DIFFERENCE',
    entityType: 'SETTLEMENT',
    entityId: '',
    reason: '',
    expiresAt: tomorrow(),
  });

  const [incident, setIncident] = useState({
    routeId: '',
    incidentType: 'CASH_DIFFERENCE',
    severity: 'MEDIUM',
    description: '',
  });

  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['operations-control'] });
  };

  const request = useMutation({
    mutationFn: () =>
      apiRequest<Authorization>('/operations-control/authorizations', {
        method: 'POST',
        body: JSON.stringify({ ...authorization, expiresAt: new Date(authorization.expiresAt).toISOString() }),
      }),
    onSuccess: async () => {
      setAuthorization((current) => ({ ...current, entityId: '', reason: '' }));
      await refresh();
    },
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) =>
      apiRequest<Authorization>(`/operations-control/authorizations/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          notes: decisionNotes[id] || `${decision === 'APPROVE' ? 'Autorización comprobada' : 'Solicitud rechazada'} por revisión`,
        }),
      }),
    onSuccess: refresh,
  });

  const report = useMutation({
    mutationFn: () =>
      apiRequest<Incident>('/operations-control/incidents', {
        method: 'POST',
        body: JSON.stringify({ ...incident, settlementId: null, referenceType: null, referenceId: null }),
      }),
    onSuccess: async () => {
      setIncident((current) => ({ ...current, description: '' }));
      await refresh();
    },
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'INVESTIGATE' | 'RESOLVE' | 'DISMISS' }) =>
      apiRequest<Incident>(`/operations-control/incidents/${id}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          notes: resolutionNotes[id] || `${action === 'RESOLVE' ? 'Causa y solución verificadas' : 'Incidencia revisada'}`,
        }),
      }),
    onSuccess: refresh,
  });

  const submitAuthorization = (event: FormEvent) => {
    event.preventDefault();
    if (!authorization.entityId) {
      alert('Por favor seleccione la liquidación o recurso correspondiente.');
      return;
    }
    request.mutate();
  };

  const submitIncident = (event: FormEvent) => {
    event.preventDefault();
    report.mutate();
  };

  return (
    <main>
      <PageHeader
        eyebrow="Control segregado"
        title="Autorizaciones e incidencias"
        description="Quien solicita o reporta no puede decidir su propio caso. Las decisiones expiran y quedan auditadas."
      />

      {/* Guías operativas para canalizar opciones al lugar correcto */}
      <div
        className="callout-grid"
        style={{
          marginBottom: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.65rem',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            color: '#166534',
          }}
        >
          <strong>🚚 ¿Corrección de productos en camión?</strong>
          <p style={{ margin: '0.25rem 0 0', color: '#15803d' }}>
            Ajuste diferencias de carga directamente en <a href="/loads/list" style={{ color: '#15803d', fontWeight: 600, textDecoration: 'underline' }}>Cargas</a> con el botón <em>✏️ Corrección</em>.
          </p>
        </div>
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.65rem',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            color: '#1e40af',
          }}
        >
          <strong>💳 ¿Modificar crédito o fiado a clientes?</strong>
          <p style={{ margin: '0.25rem 0 0', color: '#1d4ed8' }}>
            Active crédito o aumente el límite directamente en la ficha del cliente en <a href="/customers" style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'underline' }}>Clientes</a>.
          </p>
        </div>
      </div>

      <div className="dual-panels">
        {/* Formulario de nueva autorización */}
        <form className="panel section-panel" onSubmit={submitAuthorization}>
          <h2>Nueva solicitud</h2>
          <div className="form-grid compact-grid">
            <label>
              Tipo de solicitud
              <select
                value={authorization.authorizationType}
                onChange={(event) => {
                  const type = event.target.value;
                  setAuthorization({
                    ...authorization,
                    authorizationType: type,
                    entityType: type === 'SETTLEMENT_DIFFERENCE' ? 'SETTLEMENT' : 'ROUTE_LOAD',
                    entityId: '',
                  });
                }}
              >
                <option value="SETTLEMENT_DIFFERENCE">Liquidación con diferencia</option>
                <option value="OTHER_OPERATION">Otra excepción operativa</option>
              </select>
            </label>

            {authorization.authorizationType === 'SETTLEMENT_DIFFERENCE' ? (
              <label>
                Liquidación afectada
                <select
                  required
                  value={authorization.entityId}
                  onChange={(event) => setAuthorization({ ...authorization, entityId: event.target.value })}
                >
                  <option value="">Seleccionar liquidación</option>
                  {settlements.data?.map((s) => (
                    <option value={s.id} key={s.id}>
                      Carga #{s.loadNumber} · {s.routeName} ({s.sellerName}) {s.monetaryDifference !== 0 ? `· Dif: Q${s.monetaryDifference}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Ruta afectada
                <select
                  required
                  value={authorization.entityId}
                  onChange={(event) => setAuthorization({ ...authorization, entityId: event.target.value })}
                >
                  <option value="">Seleccionar ruta</option>
                  {routes.data
                    ?.filter((r) => r.status === 'ACTIVE')
                    .map((r) => (
                      <option value={r.id} key={r.id}>
                        {r.code} · {r.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label>
              Vence
              <input
                required
                type="datetime-local"
                min={dateBounds.min}
                max={dateBounds.max}
                {...calendarOnlyProps()}
                value={authorization.expiresAt}
                onChange={(event) => setAuthorization({ ...authorization, expiresAt: event.target.value })}
              />
            </label>

            <label className="full-width">
              Motivo justificado
              <textarea
                required
                placeholder="Explique detalladamente la razón de la solicitud..."
                value={authorization.reason}
                onChange={(event) => setAuthorization({ ...authorization, reason: event.target.value })}
              />
            </label>
          </div>
          <button className="primary" disabled={request.isPending}>
            {request.isPending ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>

        {/* Formulario de reporte de incidencias */}
        <form className="panel section-panel" onSubmit={submitIncident}>
          <h2>Reportar incidencia</h2>
          <div className="form-grid compact-grid">
            <label>
              Ruta
              <select
                required
                value={incident.routeId}
                onChange={(event) => setIncident({ ...incident, routeId: event.target.value })}
              >
                <option value="">Seleccionar ruta</option>
                {routes.data
                  ?.filter((route) => route.status === 'ACTIVE')
                  .map((route) => (
                    <option value={route.id} key={route.id}>
                      {route.code} · {route.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Tipo
              <select
                value={incident.incidentType}
                onChange={(event) => setIncident({ ...incident, incidentType: event.target.value })}
              >
                <option value="CASH_DIFFERENCE">Diferencia de efectivo / Dinero</option>
                <option value="ROUTE">Vehículo / Ruta / Avería</option>
                <option value="CUSTOMER">Cliente / Disputa</option>
                <option value="DEVICE">Dispositivo / Teléfono / GPS</option>
                <option value="OTHER">Otra eventualidad</option>
              </select>
            </label>

            <label>
              Severidad
              <select
                value={incident.severity}
                onChange={(event) => setIncident({ ...incident, severity: event.target.value })}
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </label>

            <label className="full-width">
              Descripción detallada
              <textarea
                required
                placeholder="Describa los hechos ocurridos..."
                value={incident.description}
                onChange={(event) => setIncident({ ...incident, description: event.target.value })}
              />
            </label>
          </div>
          <button className="primary" disabled={report.isPending}>
            {report.isPending ? 'Registrando…' : 'Registrar incidencia'}
          </button>
        </form>
      </div>

      {/* Lista de solicitudes de autorización */}
      <section className="section-panel">
        <div className="section-heading">
          <h2>Solicitudes</h2>
          <span>{authorizations.data?.length ?? 0}</span>
        </div>
        <div className="sales-grid">
          {authorizations.data?.map((item) => (
            <article className="panel sale-card" key={item.id}>
              <div className="section-heading">
                <div>
                  <strong>{authorizationTypeLabels[item.authorizationType] ?? item.authorizationType}</strong>
                  <span>Solicitado por: {item.requestedByUsername}</span>
                </div>
                <span className="status-pill">{authorizationStatusLabels[item.status] ?? item.status}</span>
              </div>
              <p>{item.reason}</p>
              <p className="status-note">Vence: {new Date(item.expiresAt).toLocaleString('es-GT')}</p>
              {canDecide && item.status === 'REQUESTED' && (
                <div className="review-box">
                  <label>
                    Notas de decisión
                    <input
                      placeholder="Comentarios de aprobación o rechazo..."
                      value={decisionNotes[item.id] ?? ''}
                      onChange={(event) =>
                        setDecisionNotes((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      className="secondary"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: item.id, decision: 'REJECT' })}
                    >
                      Rechazar
                    </button>
                    <button
                      className="primary"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: item.id, decision: 'APPROVE' })}
                    >
                      Aprobar
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Lista de incidencias reportadas */}
      <section className="section-panel">
        <div className="section-heading">
          <h2>Incidencias</h2>
          <span>{incidents.data?.length ?? 0}</span>
        </div>
        <div className="sales-grid">
          {incidents.data?.map((item) => (
            <article className="panel sale-card" key={item.id}>
              <div className="section-heading">
                <div>
                  <strong>
                    {item.incidentType} · Severidad {item.severity}
                  </strong>
                  <span>
                    {item.routeCode} · {item.routeName} · Reportó: {item.reportedByUsername}
                  </span>
                </div>
                <span className="status-pill">{incidentLabels[item.status] ?? item.status}</span>
              </div>
              <p>{item.description}</p>
              {canDecide && ['OPEN', 'INVESTIGATING'].includes(item.status) && (
                <div className="review-box">
                  <label>
                    Conclusión / Medidas
                    <input
                      placeholder="Resolución tomada..."
                      value={resolutionNotes[item.id] ?? ''}
                      onChange={(event) =>
                        setResolutionNotes((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
                  </label>
                  <div className="form-actions">
                    {item.status === 'OPEN' && (
                      <button
                        className="secondary"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: item.id, action: 'INVESTIGATE' })}
                      >
                        Investigar
                      </button>
                    )}
                    <button
                      className="primary"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: item.id, action: 'RESOLVE' })}
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

