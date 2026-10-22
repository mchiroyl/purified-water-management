import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import type { Customer, Route } from '../routes/types';
import type {
  JugBalanceResponse,
  JugEventRequest,
  JugEventType,
  JugHistoryResponse,
  JugRouteSummaryResponse,
} from './types';
import { Truck, AlertTriangle, Layers, List, ChevronDown, ChevronUp, PackageCheck, Users, Search, X, User } from 'lucide-react';

type JugsPageProps = {
  canRecord?: boolean;
  canViewSummary?: boolean;
};

export function JugsPage({ canRecord = true, canViewSummary = true }: JugsPageProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'record' | 'customers' | 'routes'>('customers');

  // Deep-link: si llegan con ?customerId=UUID, pre-seleccionar el cliente en historial
  useEffect(() => {
    const preselect = searchParams.get('customerId');
    if (preselect) {
      setHistoryCustomerId(preselect);
      setActiveTab('customers');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catálogos
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const routes = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiRequest<Route[]>('/routes'),
  });

  // Consulta global de saldos de garrafones pendientes por cliente y ruta
  const outstandingBalances = useQuery({
    queryKey: ['jugs', 'outstanding'],
    queryFn: () => apiRequest<JugBalanceResponse[]>('/jugs/outstanding'),
  });

  // Estado del formulario de registro
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [eventType, setEventType] = useState<JugEventType>('LENT');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado para consulta de historial por cliente
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const customerHistory = useQuery({
    queryKey: ['jugs', 'history', historyCustomerId],
    queryFn: () => apiRequest<JugHistoryResponse>(`/jugs/customers/${historyCustomerId}/history`),
    enabled: !!historyCustomerId,
  });

  // Estado para resumen por ruta
  const [summaryRouteId, setSummaryRouteId] = useState('');
  const routeSummary = useQuery({
    queryKey: ['jugs', 'route-summary', summaryRouteId],
    queryFn: () => apiRequest<JugRouteSummaryResponse>(`/jugs/routes/${summaryRouteId}/summary`),
    enabled: !!summaryRouteId,
  });

  // Saldo de cliente seleccionado en formulario
  const currentCustomerBalance = useQuery({
    queryKey: ['jugs', 'balance', selectedCustomerId],
    queryFn: () => apiRequest<JugBalanceResponse>(`/jugs/customers/${selectedCustomerId}/balance`),
    enabled: !!selectedCustomerId,
  });

  // Estados de búsqueda, filtros por ruta y modo de visualización en la pestaña principal
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [scopeFilter, setScopeFilter] = useState<'outstanding' | 'all'>('outstanding');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Mutación para registrar evento
  const recordMutation = useMutation({
    mutationFn: (data: JugEventRequest) =>
      apiRequest('/jugs/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setFeedbackMessage({ type: 'success', text: 'Evento de garrafón registrado exitosamente.' });
      setQuantity(1);
      setUnitPrice('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['jugs'] });
    },
    onError: (err: Error) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error al registrar el evento.' });
    },
  });

  const handleCustomerSelect = (custId: string, preferredRouteId?: string | null) => {
    setSelectedCustomerId(custId);
    setFeedbackMessage(null);
    if (preferredRouteId) {
      setSelectedRouteId(preferredRouteId);
      return;
    }
    const found = customers.data?.find(c => c.id === custId);
    if (found?.routeId) {
      setSelectedRouteId(found.routeId);
    }
  };

  const handleSubmitEvent = (e: FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    if (!selectedCustomerId) {
      setFeedbackMessage({ type: 'error', text: 'Seleccione un cliente.' });
      return;
    }
    if (!selectedRouteId) {
      setFeedbackMessage({ type: 'error', text: 'Seleccione una ruta.' });
      return;
    }
    if (quantity <= 0) {
      setFeedbackMessage({ type: 'error', text: 'La cantidad debe ser mayor a 0.' });
      return;
    }

    const payload: JugEventRequest = {
      customerId: selectedCustomerId,
      routeId: selectedRouteId,
      eventType,
      quantity,
      unitPrice: eventType.startsWith('CHARGED') && unitPrice ? parseFloat(unitPrice) : null,
      notes: notes.trim(),
    };

    recordMutation.mutate(payload);
  };

  // Construir mapa de saldos por cliente desde outstandingBalances
  const customerBalancesMap = useMemo(() => {
    const map = new Map<string, JugBalanceResponse>();
    (outstandingBalances.data ?? []).forEach(b => {
      map.set(b.customerId, b);
    });
    return map;
  }, [outstandingBalances.data]);

  // Lista unificada de registros según el alcance seleccionado
  const combinedJugRecords = useMemo(() => {
    if (scopeFilter === 'outstanding') {
      return (outstandingBalances.data ?? []).map(b => ({
        customerId: b.customerId,
        customerCode: b.customerCode || '',
        customerName: b.customerName,
        customerPhone: b.customerPhone || '',
        routeId: b.routeId,
        routeCode: b.routeCode || '',
        routeName: b.routeName,
        jugsOutstanding: b.jugsOutstanding,
      }));
    }

    // Alcance 'all': muestra todos los clientes registrados y su respectivo saldo de garrafones
    return (customers.data ?? []).map(c => {
      const balance = customerBalancesMap.get(c.id);
      return {
        customerId: c.id,
        customerCode: c.code || '',
        customerName: c.name,
        customerPhone: c.phone || '',
        routeId: c.routeId || '',
        routeCode: c.routeCode || '',
        routeName: c.routeName || 'Sin ruta asignada',
        jugsOutstanding: balance ? balance.jugsOutstanding : 0,
      };
    });
  }, [scopeFilter, outstandingBalances.data, customers.data, customerBalancesMap]);

  // Filtrar registros por la búsqueda ingresada por el administrador
  const filteredJugRecords = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return combinedJugRecords;
    return combinedJugRecords.filter(r =>
      r.customerName.toLowerCase().includes(q) ||
      (r.customerCode && r.customerCode.toLowerCase().includes(q)) ||
      (r.customerPhone && r.customerPhone.toLowerCase().includes(q)) ||
      (r.routeName && r.routeName.toLowerCase().includes(q))
    );
  }, [combinedJugRecords, customerSearch]);

  type JugRouteGroup = {
    key: string;
    routeId?: string;
    routeCode?: string;
    routeName: string;
    totalJugs: number;
    customers: typeof combinedJugRecords;
  };

  // Agrupar clientes por ruta y ordenarlos alfabéticamente
  const jugRouteGroups = useMemo(() => {
    const map = new Map<string, JugRouteGroup>();

    filteredJugRecords.forEach(item => {
      const key = item.routeId || (item.routeName ? item.routeName : 'UNASSIGNED');
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          routeId: item.routeId,
          routeCode: item.routeCode,
          routeName: item.routeName || (item.routeId ? 'Ruta asignada' : 'Sin ruta asignada'),
          totalJugs: 0,
          customers: [],
        };
        map.set(key, group);
      }
      group.customers.push(item);
      group.totalJugs += item.jugsOutstanding;
    });

    // Ordenar clientes dentro de cada ruta: mayor deuda de garrafones primero, luego nombre
    map.forEach(group => {
      group.customers.sort((a, b) => {
        if (b.jugsOutstanding !== a.jugsOutstanding) {
          return b.jugsOutstanding - a.jugsOutstanding;
        }
        return a.customerName.localeCompare(b.customerName, 'es', { sensitivity: 'base' });
      });
    });

    // Ordenar grupos: Rutas asignadas alfabéticamente, 'Sin ruta asignada' al final
    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (a.key === 'UNASSIGNED' || a.routeName === 'Sin ruta asignada') return 1;
      if (b.key === 'UNASSIGNED' || b.routeName === 'Sin ruta asignada') return -1;
      return a.routeName.localeCompare(b.routeName, 'es', { sensitivity: 'base' });
    });

    return result;
  }, [filteredJugRecords]);

  const displayedGroups = useMemo(() => {
    if (selectedRouteFilter === 'ALL') return jugRouteGroups;
    return jugRouteGroups.filter(g => g.key === selectedRouteFilter);
  }, [jugRouteGroups, selectedRouteFilter]);

  // Si el cliente buscado tiene envases en múltiples rutas, detectar las rutas
  const multiRouteNotice = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q || filteredJugRecords.length <= 1) return null;
    const distinctRoutes = Array.from(new Set(filteredJugRecords.map(r => r.routeName || 'Sin ruta asignada')));
    if (distinctRoutes.length > 1) {
      return {
        query: customerSearch.trim(),
        routes: distinctRoutes,
        totalCustomers: filteredJugRecords.length,
        totalJugs: filteredJugRecords.reduce((sum, item) => sum + item.jugsOutstanding, 0),
      };
    }
    return null;
  }, [filteredJugRecords, customerSearch]);

  // Indicadores métricos generales para las tarjetas resumen
  const overallMetrics = useMemo(() => {
    const balances = outstandingBalances.data ?? [];
    const totalJugs = balances.reduce((sum, b) => sum + b.jugsOutstanding, 0);
    const totalCustomersWithJugs = balances.filter(b => b.jugsOutstanding > 0).length;
    const distinctRoutesWithJugs = new Set(balances.filter(b => b.jugsOutstanding > 0).map(b => b.routeName)).size;
    return {
      totalJugs,
      totalCustomersWithJugs,
      distinctRoutesWithJugs,
    };
  }, [outstandingBalances.data]);

  // Mapa de información de clientes (contacto, etc.)
  const customerInfoMap = useMemo(() => {
    const map = new Map<string, Customer>();
    (customers.data ?? []).forEach(c => map.set(c.id, c));
    return map;
  }, [customers.data]);

  const renderJugTable = (records: typeof combinedJugRecords, showRouteColumn: boolean = false) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Código</th>
            {showRouteColumn && <th>Ruta</th>}
            <th>Teléfono</th>
            <th style={{ textAlign: 'center' }}>Garrafones Prestados</th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {records.map((item, idx) => {
            const custInfo = customerInfoMap.get(item.customerId);
            const isOutstanding = item.jugsOutstanding > 0;
            return (
              <tr key={`${item.customerId}-${item.routeId || idx}`}>
                <td>
                  <strong>{item.customerName}</strong>
                  {custInfo?.contactName && (
                    <small style={{ display: 'block', color: '#64748b' }}>
                      Contacto: {custInfo.contactName}
                    </small>
                  )}
                </td>
                <td>
                  <code>{item.customerCode || custInfo?.code || '—'}</code>
                </td>
                {showRouteColumn && (
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Truck size={13} style={{ color: '#0284c7' }} />
                      {item.routeCode ? `${item.routeCode} · ` : ''}{item.routeName}
                    </span>
                  </td>
                )}
                <td>{item.customerPhone || custInfo?.phone || '—'}</td>
                <td style={{ textAlign: 'center' }}>
                  {isOutstanding ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fde68a',
                      }}
                    >
                      <PackageCheck size={14} style={{ color: '#d97706' }} />
                      {item.jugsOutstanding} {item.jugsOutstanding === 1 ? 'garrafón' : 'garrafones'}
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        fontWeight: 500,
                        fontSize: '0.82rem',
                        backgroundColor: '#f1f5f9',
                        color: '#64748b',
                      }}
                    >
                      0 al día
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setHistoryCustomerId(item.customerId)}
                      title="Ver historial de préstamos y devoluciones"
                    >
                      Ver Historial
                    </button>
                    {canRecord && (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          handleCustomerSelect(item.customerId, item.routeId);
                          setActiveTab('record');
                        }}
                        title="Registrar devolución, préstamo o cobro"
                      >
                        Movimiento
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <main>
      <PageHeader
        eyebrow="Operación y Control"
        title="Control de Garrafones"
        description="Gestión de envases prestados a clientes, devoluciones y cobro por pérdidas o deterioro."
        actions={
          <div className="filter-group">
            <button
              type="button"
              className={activeTab === 'customers' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('customers')}
            >
              Saldos de Clientes
            </button>
            {canRecord && (
              <button
                type="button"
                className={activeTab === 'record' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('record')}
              >
                Registrar Movimiento
              </button>
            )}
            {canViewSummary && (
              <button
                type="button"
                className={activeTab === 'routes' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('routes')}
              >
                Resumen por Ruta
              </button>
            )}
          </div>
        }
      />

      {/* ── TAB 1: SALDOS POR CLIENTE Y POR RUTA ── */}
      {activeTab === 'customers' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <div>
              <h2>Control y Saldos de Garrafones Prestados</h2>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
                Monitoreo de envases prestados en poder de los clientes por ruta asignada.
              </p>
            </div>
          </div>

          {/* Tarjetas KPI de resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', margin: '0.5rem 0 1.25rem 0' }}>
            <div className="panel" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '1rem' }}>
              <small style={{ color: '#92400e', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <PackageCheck size={14} /> Total Garrafones en Calle
              </small>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.35rem 0 0.1rem 0', color: '#b45309' }}>
                {overallMetrics.totalJugs.toLocaleString()}
              </p>
              <small style={{ color: '#78350f' }}>Envases prestados pendientes de devolución</small>
            </div>

            <div className="panel" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '1rem' }}>
              <small style={{ color: '#0369a1', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Users size={14} /> Clientes con Garrafones
              </small>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.35rem 0 0.1rem 0', color: '#0284c7' }}>
                {overallMetrics.totalCustomersWithJugs.toLocaleString()}
              </p>
              <small style={{ color: '#075985' }}>Clientes con saldo &gt; 0 envases</small>
            </div>

            <div className="panel" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
              <small style={{ color: '#475569', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Truck size={14} /> Rutas con Garrafones
              </small>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.35rem 0 0.1rem 0', color: '#334155' }}>
                {overallMetrics.distinctRoutesWithJugs.toLocaleString()}
              </p>
              <small style={{ color: '#64748b' }}>Rutas comerciales con envases activos</small>
            </div>
          </div>

          {/* Barra de Búsqueda y Filtros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              {/* Buscador de clientes */}
              <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '480px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="search"
                  placeholder="Buscar por cliente, código, teléfono o ruta…"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: customerSearch ? '2rem' : '0.75rem' }}
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      color: '#64748b',
                    }}
                    title="Limpiar búsqueda"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Selector de alcance y selector de vista */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="filter-group" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={scopeFilter === 'outstanding' ? 'primary' : 'secondary'}
                    onClick={() => setScopeFilter('outstanding')}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  >
                    Solo con saldo (&gt; 0)
                  </button>
                  <button
                    type="button"
                    className={scopeFilter === 'all' ? 'primary' : 'secondary'}
                    onClick={() => setScopeFilter('all')}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  >
                    Todos los clientes
                  </button>
                </div>

                <div className="filter-group" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={viewMode === 'grouped' ? 'primary' : 'secondary'}
                    onClick={() => setViewMode('grouped')}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Agrupar clientes por ruta"
                  >
                    <Layers size={14} /> Agrupado por Ruta
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'flat' ? 'primary' : 'secondary'}
                    onClick={() => setViewMode('flat')}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Lista plana corrida"
                  >
                    <List size={14} /> Lista Plana
                  </button>
                </div>
              </div>
            </div>

            {/* Píldoras de filtro rápido por ruta */}
            {jugRouteGroups.length > 0 && (
              <div className="customer-filter-pills">
                <button
                  type="button"
                  className={`customer-filter-pill ${selectedRouteFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSelectedRouteFilter('ALL')}
                >
                  Todas las rutas ({filteredJugRecords.length})
                </button>
                {jugRouteGroups.map(grp => (
                  <button
                    type="button"
                    key={grp.key}
                    className={`customer-filter-pill ${selectedRouteFilter === grp.key ? 'active' : ''}`}
                    onClick={() => setSelectedRouteFilter(grp.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    {grp.key === 'UNASSIGNED' || grp.routeName === 'Sin ruta asignada' ? (
                      <AlertTriangle size={13} style={{ color: '#b45309' }} />
                    ) : (
                      <Truck size={13} style={{ color: '#0284c7' }} />
                    )}
                    {grp.routeCode ? `${grp.routeCode} · ` : ''}{grp.routeName} · <strong>{grp.totalJugs} garrafones</strong> ({grp.customers.length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aviso especial cuando un cliente buscado está presente en múltiples rutas */}
          {multiRouteNotice && (
            <div
              className="alert"
              style={{
                backgroundColor: '#eff6ff',
                borderColor: '#bfdbfe',
                color: '#1e40af',
                padding: '0.85rem 1.15rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <AlertTriangle size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                  Cliente con presencia en múltiples rutas ({multiRouteNotice.routes.length} rutas detectadas)
                </strong>
                <span style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>
                  El cliente "{multiRouteNotice.query}" tiene garrafones registrados en: <strong>{multiRouteNotice.routes.join(', ')}</strong>, sumando un total de <strong>{multiRouteNotice.totalJugs} garrafones prestados</strong>. A continuación se presentan las filas desglosadas por cada ruta.
                </span>
              </div>
            </div>
          )}

          {/* Mensajes de carga o error */}
          {(outstandingBalances.isLoading || customers.isLoading) && <p>Cargando información de garrafones y clientes…</p>}
          {outstandingBalances.error && <div className="alert error">{outstandingBalances.error.message}</div>}
          {customers.error && <div className="alert error">{customers.error.message}</div>}

          {/* Vista Agrupada por Ruta */}
          {!outstandingBalances.isLoading && !customers.isLoading && viewMode === 'grouped' && displayedGroups.length > 0 && (
            <div className="customer-groups-container">
              {displayedGroups.map(group => {
                const isCollapsed = Boolean(collapsedGroups[group.key]);
                const isUnassigned = group.key === 'UNASSIGNED' || group.routeName === 'Sin ruta asignada';

                return (
                  <article className="route-group-panel" key={group.key} style={{ marginBottom: '1.25rem' }}>
                    <div
                      className={`route-group-banner ${isUnassigned ? 'unassigned' : ''}`}
                      onClick={() => toggleGroupCollapse(group.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') toggleGroupCollapse(group.key);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="route-group-info">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: isUnassigned ? '#fef3c7' : '#e0f2fe',
                          }}
                        >
                          {isUnassigned ? <AlertTriangle size={20} style={{ color: '#b45309' }} /> : <Truck size={20} style={{ color: '#0369a1' }} />}
                        </div>
                        <div>
                          <h3 className="route-group-title" style={{ margin: 0, fontSize: '1.05rem' }}>
                            {isUnassigned ? 'Sin Ruta Asignada' : `Ruta ${group.routeName} ${group.routeCode ? `(${group.routeCode})` : ''}`}
                          </h3>
                          <span className="route-group-subtitle" style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            {group.customers.length} {group.customers.length === 1 ? 'cliente' : 'clientes'} en esta ruta
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            border: '1px solid #fde68a',
                          }}
                        >
                          <PackageCheck size={14} style={{ color: '#d97706' }} />
                          Total Ruta: {group.totalJugs} {group.totalJugs === 1 ? 'garrafón' : 'garrafones'}
                        </span>

                        <span
                          className="badge"
                          style={{
                            background: isUnassigned ? '#fef3c7' : '#e0f2fe',
                            color: isUnassigned ? '#92400e' : '#0369a1',
                            fontWeight: 600,
                            padding: '0.3rem 0.65rem',
                            borderRadius: '1rem',
                            fontSize: '0.82rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <Users size={13} />
                          {group.customers.length} {group.customers.length === 1 ? 'cliente' : 'clientes'}
                        </span>

                        <span
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--muted)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          {isCollapsed ? (
                            <>
                              <ChevronDown size={14} /> Desplegar
                            </>
                          ) : (
                            <>
                              <ChevronUp size={14} /> Plegar
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {!isCollapsed && renderJugTable(group.customers, false)}
                  </article>
                );
              })}
            </div>
          )}

          {/* Vista Plana Corrida */}
          {!outstandingBalances.isLoading && !customers.isLoading && viewMode === 'flat' && filteredJugRecords.length > 0 && (
            renderJugTable(filteredJugRecords, true)
          )}

          {/* Estado vacío cuando no hay registros */}
          {!outstandingBalances.isLoading && !customers.isLoading && filteredJugRecords.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
              <PackageCheck size={36} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>No se encontraron registros de garrafones</h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                {customerSearch
                  ? `No hay coincidencias para la búsqueda "${customerSearch}".`
                  : scopeFilter === 'outstanding'
                    ? '¡Excelente! No hay clientes con garrafones pendientes en este momento.'
                    : 'No hay clientes registrados en el sistema.'}
              </p>
              {customerSearch && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCustomerSearch('')}
                  style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── MODAL / PANEL DE HISTORIAL ── */}
      {historyCustomerId && (
        <section className="panel section-panel" style={{ marginTop: '1.5rem', borderColor: 'var(--primary, #007680)' }}>
          <div className="section-heading">
            <div>
              <h2>Historial de Garrafones — {customerHistory.data?.customerName ?? 'Cargando…'}</h2>
              <span className="status active" style={{ fontSize: '1rem', padding: '0.3rem 0.8rem' }}>
                Garrafones Pendientes: <strong>{customerHistory.data?.jugsOutstanding ?? 0}</strong>
              </span>
            </div>
            <button type="button" className="secondary" onClick={() => setHistoryCustomerId(null)}>
              Cerrar
            </button>
          </div>

          {customerHistory.isLoading && <p>Cargando historial…</p>}
          {customerHistory.error && <div className="alert error">{customerHistory.error.message}</div>}

          {customerHistory.data && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Precio Unitario</th>
                    <th>Ruta</th>
                    <th>Registrado por</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {customerHistory.data.events.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center' }} className="muted">
                        No hay movimientos de garrafones para este cliente.
                      </td>
                    </tr>
                  ) : (
                    customerHistory.data.events.map(ev => {
                      const isAddition = ev.eventType === 'LENT';
                      return (
                        <tr key={ev.id}>
                          <td>{new Date(ev.createdAt).toLocaleString()}</td>
                          <td>
                            <span
                              className={`status ${isAddition ? 'active' : 'inactive'}`}
                              style={{ fontWeight: 'bold' }}
                            >
                              {ev.eventType === 'LENT' && 'PRESTADO (+)'}
                              {ev.eventType === 'RETURNED' && 'DEVUELTO (-)'}
                              {ev.eventType === 'CHARGED_LOSS' && 'COBRO PÉRDIDA (-)'}
                              {ev.eventType === 'CHARGED_DAMAGE' && 'COBRO DAÑO (-)'}
                            </span>
                          </td>
                          <td>
                            <strong>{ev.quantity}</strong>
                          </td>
                          <td>{ev.unitPrice ? `Q ${ev.unitPrice.toFixed(2)}` : '—'}</td>
                          <td>{ev.routeName}</td>
                          <td>{ev.registeredByName}</td>
                          <td>{ev.notes || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── TAB 2: REGISTRAR MOVIMIENTO ── */}
      {activeTab === 'record' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Registrar Movimiento de Garrafón</h2>
          </div>

          {feedbackMessage && (
            <div className={`alert ${feedbackMessage.type}`}>{feedbackMessage.text}</div>
          )}

          <form onSubmit={handleSubmitEvent} className="form-grid">
            <label>
              Cliente *
              <select
                required
                value={selectedCustomerId}
                onChange={e => handleCustomerSelect(e.target.value)}
              >
                <option value="">-- Seleccionar cliente --</option>
                {customers.data?.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedCustomerId && (
              <div style={{ gridColumn: 'span 2', padding: '0.8rem', background: '#f0f9fa', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <p style={{ margin: 0 }}>
                  Garrafones en poder del cliente actualmente:{' '}
                  <strong style={{ fontSize: '1.2rem', color: '#007680' }}>
                    {currentCustomerBalance.data?.jugsOutstanding ?? '…'}
                  </strong>
                </p>
              </div>
            )}

            <label>
              Ruta *
              <select
                required
                value={selectedRouteId}
                onChange={e => setSelectedRouteId(e.target.value)}
              >
                <option value="">-- Seleccionar ruta --</option>
                {routes.data?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo de Evento *
              <select
                required
                value={eventType}
                onChange={e => setEventType(e.target.value as JugEventType)}
              >
                <option value="LENT">Dejar Garrafones Prestados (+)</option>
                <option value="RETURNED">Recibir Vacíos Devueltos (-)</option>
                <option value="CHARGED_LOSS">Cobrar Garrafón Perdido (-)</option>
                <option value="CHARGED_DAMAGE">Cobrar Garrafón Dañado (-)</option>
              </select>
            </label>

            <label>
              Cantidad de Garrafones *
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
              />
            </label>

            {eventType.startsWith('CHARGED') && (
              <label>
                Precio Unitario de Cobro (Q) *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Ej. 45.00"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                />
              </label>
            )}

            <label style={{ gridColumn: 'span 2' }}>
              Notas / Observaciones
              <input
                type="text"
                placeholder="Detalle o motivo del movimiento…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </label>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="primary" disabled={recordMutation.isPending}>
                {recordMutation.isPending ? 'Registrando…' : 'Guardar Movimiento'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setFeedbackMessage(null);
                  setSelectedCustomerId('');
                  setQuantity(1);
                  setNotes('');
                }}
              >
                Limpiar
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── TAB 3: RESUMEN POR RUTA ── */}
      {activeTab === 'routes' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Garrafones Pendientes por Ruta</h2>
            <select
              value={summaryRouteId}
              onChange={e => setSummaryRouteId(e.target.value)}
              style={{ maxWidth: '300px' }}
            >
              <option value="">-- Seleccionar ruta --</option>
              {routes.data?.map(r => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name}
                </option>
              ))}
            </select>
          </div>

          {summaryRouteId && routeSummary.isLoading && <p>Cargando resumen de ruta…</p>}
          {summaryRouteId && routeSummary.error && <div className="alert error">{routeSummary.error.message}</div>}

          {routeSummary.data && (
            <>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                <div className="panel" style={{ flex: 1, textAlign: 'center', background: '#e5f6f7' }}>
                  <h3 style={{ margin: 0, color: '#007680' }}>Total Garrafones en Calle</h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                    {routeSummary.data.totalJugsOutstanding}
                  </p>
                </div>
                <div className="panel" style={{ flex: 1, textAlign: 'center', background: '#f5f7f8' }}>
                  <h3 style={{ margin: 0 }}>Clientes con Garrafones</h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                    {routeSummary.data.totalCustomersWithJugs}
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Ruta</th>
                      <th>Garrafones Pendientes</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeSummary.data.customerBalances.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center' }} className="muted">
                          No hay clientes con garrafones pendientes en esta ruta.
                        </td>
                      </tr>
                    ) : (
                      routeSummary.data.customerBalances.map(cb => (
                        <tr key={cb.customerId}>
                          <td><strong>{cb.customerName}</strong></td>
                          <td>{cb.routeName}</td>
                          <td>
                            <strong style={{ color: '#007680', fontSize: '1.1rem' }}>
                              {cb.jugsOutstanding}
                            </strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setHistoryCustomerId(cb.customerId)}
                            >
                              Ver Historial
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
