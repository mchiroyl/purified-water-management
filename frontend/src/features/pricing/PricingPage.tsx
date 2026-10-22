import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../app/PageHeader';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/apiClient';
import { calendarOnlyProps, currentMonthDateTimeBounds } from '../../utils/dateInput';
import { Truck, AlertTriangle, Layers, List, ChevronDown, ChevronUp } from 'lucide-react';

type Tier = { id: string; presentationId: string; presentationCode: string; presentationName: string; minimumBaseUnits: number; maximumBaseUnits?: number; unitPrice: number };
type Version = { id: string; versionNumber: number; validFrom: string; validTo?: string; status: string; tiers: Tier[] };
type PriceList = { id: string; code: string; name: string; status: string; currencyCode: string; versions: Version[] };
type Product = { id: string; name: string; presentations: Array<{ id: string; code: string; name: string; active: boolean }> };
type Customer = {
  id: string;
  code: string;
  name: string;
  customerType?: string;
  registrationState?: string;
  routeId?: string;
  routeCode?: string;
  routeName?: string;
  sellerName?: string;
  status?: string;
};
type Special = {
  id: string;
  customerId?: string;
  customerCode?: string;
  customerName: string;
  presentationId?: string;
  presentationCode?: string;
  presentationName: string;
  unitPrice: number;
  validFrom: string;
  validTo?: string;
  status: string;
  routeId?: string;
  routeCode?: string;
  routeName?: string;
};
type Discount = { id: string; requesterUsername: string; customerName: string; presentationName: string; normalPrice: number; requestedPrice: number; reason: string; status: string; expiresAt: string; createdAt: string };
type DraftTier = { presentationId: string; minimumBaseUnits: number | ''; maximumBaseUnits: string; unitPrice: number | '' };

const emptyTier = (): DraftTier => ({ presentationId: '', minimumBaseUnits: '', maximumBaseUnits: '', unitPrice: '' });

function localDateTime(hoursAhead = 0): string {
  const date = new Date(Date.now() + hoursAhead * 3_600_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin límite';
}

export function PricingPage({ view = 'create', canManage, canApprove, canRequestDiscount }: { view?: 'create' | 'list'; canManage: boolean; canApprove: boolean; canRequestDiscount: boolean }) {
  const dateBounds = currentMonthDateTimeBounds();
  const navigate = useNavigate();
  const client = useQueryClient();
  const lists = useQuery({ queryKey: ['pricing', 'lists'], queryFn: () => apiRequest<PriceList[]>('/pricing/lists') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canManage || canRequestDiscount });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers'), enabled: canManage || canApprove || canRequestDiscount });
  const specials = useQuery({ queryKey: ['pricing', 'specials'], queryFn: () => apiRequest<Special[]>('/pricing/special-prices'), enabled: canManage || canApprove });
  const discounts = useQuery({ queryKey: ['pricing', 'discounts'], queryFn: () => apiRequest<Discount[]>('/pricing/discounts'), enabled: canApprove || canRequestDiscount });
  const presentations = products.data?.flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, productName: product.name }))) ?? [];
  const [listForm, setListForm] = useState({ name: '', currencyCode: 'GTQ' });
  const [selectedList, setSelectedList] = useState('');
  const [validFrom, setValidFrom] = useState(localDateTime());
  const [tiers, setTiers] = useState<DraftTier[]>([emptyTier()]);
  const [special, setSpecial] = useState({ customerId: '', presentationId: '', unitPrice: 0, validFrom: localDateTime(), validTo: '' });
  const [specialCustomerSearch, setSpecialCustomerSearch] = useState('');
  const [isSpecialCustomerOpen, setIsSpecialCustomerOpen] = useState(false);
  const specialCustomerPickerRef = useRef<HTMLDivElement>(null);

  // Estados para búsqueda, agrupación y filtrado por ruta en "Precios especiales registrados"
  const [specialSearchQuery, setSpecialSearchQuery] = useState('');
  const [specialRouteFilter, setSpecialRouteFilter] = useState('ALL');
  const [specialViewMode, setSpecialViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [collapsedSpecialGroups, setCollapsedSpecialGroups] = useState<Record<string, boolean>>({});

  const toggleSpecialGroup = (key: string) => {
    setCollapsedSpecialGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCustomer = useMemo(
    () => customers.data?.find(c => c.id === special.customerId),
    [customers.data, special.customerId]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (specialCustomerPickerRef.current && !specialCustomerPickerRef.current.contains(event.target as Node)) {
        setIsSpecialCustomerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clientes ordenados por ruta y luego alfabéticamente por nombre
  const sortedCustomers = useMemo(() => {
    const list = [...(customers.data ?? [])];
    list.sort((a, b) => {
      const rA = a.routeName || 'ZZZZ';
      const rB = b.routeName || 'ZZZZ';
      const routeCmp = rA.localeCompare(rB, 'es', { sensitivity: 'base' });
      if (routeCmp !== 0) return routeCmp;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
    return list;
  }, [customers.data]);

  const matchingCustomers = useMemo(() => {
    const query = specialCustomerSearch.trim().toLowerCase();
    if (!query) return sortedCustomers;
    const selected = sortedCustomers.find(c => c.id === special.customerId);
    if (selected && `${selected.code} · ${selected.name}`.toLowerCase() === query) {
      return sortedCustomers;
    }
    return sortedCustomers.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.code.toLowerCase().includes(query) ||
      (c.routeName && c.routeName.toLowerCase().includes(query))
    );
  }, [sortedCustomers, specialCustomerSearch, special.customerId]);

  // Agrupar coincidencias por ruta para mostrar secciones claras en el selector
  const matchingCustomerRouteGroups = useMemo(() => {
    const map = new Map<string, { routeName: string; customers: Customer[] }>();
    matchingCustomers.forEach(customer => {
      const rName = customer.routeName || 'Sin ruta asignada';
      let group = map.get(rName);
      if (!group) {
        group = { routeName: rName, customers: [] };
        map.set(rName, group);
      }
      group.customers.push(customer);
    });
    return Array.from(map.values());
  }, [matchingCustomers]);

  const [discount, setDiscount] = useState({ customerId: '', presentationId: '', quantityBaseUnits: 1, requestedPrice: 0, reason: '', expiresAt: localDateTime(2) });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const desdeInputRef = useRef<HTMLInputElement>(null);
  const [listMessage, setListMessage] = useState('');
  const [specialMessage, setSpecialMessage] = useState('');
  const [discountMessage, setDiscountMessage] = useState('');
  useEffect(() => { if (!selectedList && lists.data?.[0]) setSelectedList(lists.data[0].id); }, [lists.data, selectedList]);
  const refresh = () => void client.invalidateQueries({ queryKey: ['pricing'] });

  const closeToast = () => {
    setShowToast(false);
    setTimeout(() => {
      desdeInputRef.current?.focus();
    }, 50);
  };

  const triggerSavedToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);

    // Limpiar campos inmediatamente para evitar doble registro
    setTiers([emptyTier()]);
    setValidFrom(localDateTime());
  };

  const createList = useMutation({
    mutationFn: () => apiRequest<PriceList>('/pricing/lists', { method: 'POST', body: JSON.stringify(listForm) }),
    onSuccess: data => {
      setListForm({ name: '', currencyCode: 'GTQ' });
      setSelectedList(data.id);
      setListMessage(`¡Lista "${data.name}" (${data.code}) creada exitosamente!`);
      refresh();
    }
  });
  const createVersion = useMutation({
    mutationFn: () => apiRequest<PriceList>(`/pricing/lists/${selectedList}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        validFrom: new Date(validFrom).toISOString(),
        tiers: tiers.map(item => ({
          ...item,
          minimumBaseUnits: item.minimumBaseUnits === '' ? 1 : Number(item.minimumBaseUnits),
          unitPrice: item.unitPrice === '' ? 0 : Number(item.unitPrice),
          maximumBaseUnits: item.maximumBaseUnits === '' ? null : Number(item.maximumBaseUnits)
        }))
      })
    }),
    onSuccess: (data) => {
      refresh();
      const vNum = data.versions?.at(-1)?.versionNumber;
      const msg = vNum
        ? `Versión ${vNum} registrada exitosamente. Se guardó en borrador.`
        : 'Versión de precios registrada exitosamente. Se guardó en borrador.';
      triggerSavedToast(msg);
    }
  });
  const activate = useMutation({ mutationFn: (id: string) => apiRequest<PriceList>(`/pricing/versions/${id}/activate`, { method: 'POST' }), onSuccess: refresh });
  const createSpecial = useMutation({
    mutationFn: () => apiRequest<Special>('/pricing/special-prices', { method: 'POST', body: JSON.stringify({ ...special, validFrom: new Date(special.validFrom).toISOString(), validTo: special.validTo ? new Date(special.validTo).toISOString() : null }) }),
    onSuccess: () => {
      setSpecial({ customerId: '', presentationId: '', unitPrice: 0, validFrom: localDateTime(), validTo: '' });
      setSpecialCustomerSearch('');
      setIsSpecialCustomerOpen(false);
      setSpecialMessage('¡Precio especial por cliente guardado exitosamente! El cliente quedó habilitado como cliente permanente.');
      refresh();
      void client.invalidateQueries({ queryKey: ['customers'] });
    }
  });
  const requestDiscount = useMutation({
    mutationFn: () => apiRequest<Discount>('/pricing/discounts', { method: 'POST', body: JSON.stringify({ ...discount, expiresAt: new Date(discount.expiresAt).toISOString() }) }),
    onSuccess: () => {
      setDiscount({ customerId: '', presentationId: '', quantityBaseUnits: 1, requestedPrice: 0, reason: '', expiresAt: localDateTime(2) });
      setDiscountMessage('¡Solicitud de descuento enviada para autorización!');
      refresh();
    }
  });
  const decide = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => apiRequest<Discount>(`/pricing/discounts/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }), onSuccess: refresh });
  const submit = (event: FormEvent, action: () => void) => { event.preventDefault(); action(); };
  const updateTier = (index: number, patch: Partial<DraftTier>) => setTiers(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const isCreateView = view === 'create';
  const registeredVersions = lists.data?.flatMap(list => list.versions.map(version => ({ list, version }))).sort((a, b) => new Date(b.version.validFrom).getTime() - new Date(a.version.validFrom).getTime()) ?? [];

  // Enriquecer precios especiales con información de ruta
  const enrichedSpecials = useMemo(() => {
    const customerMap = new Map<string, Customer>();
    (customers.data ?? []).forEach(c => {
      customerMap.set(c.id, c);
    });

    return (specials.data ?? []).map(sp => {
      const cust = sp.customerId ? customerMap.get(sp.customerId) : undefined;
      const routeName = sp.routeName || cust?.routeName || '';
      const routeCode = sp.routeCode || cust?.routeCode || '';
      const routeId = sp.routeId || cust?.routeId || '';
      return {
        ...sp,
        routeName,
        routeCode,
        routeId,
      };
    });
  }, [specials.data, customers.data]);

  const filteredSpecials = useMemo(() => {
    const query = specialSearchQuery.trim().toLowerCase();
    if (!query) return enrichedSpecials;
    return enrichedSpecials.filter(item =>
      item.customerName.toLowerCase().includes(query) ||
      (item.customerCode && item.customerCode.toLowerCase().includes(query)) ||
      item.presentationName.toLowerCase().includes(query) ||
      (item.routeName && item.routeName.toLowerCase().includes(query))
    );
  }, [enrichedSpecials, specialSearchQuery]);

  type SpecialRouteGroup = {
    key: string;
    routeId?: string;
    routeCode?: string;
    routeName: string;
    specials: typeof enrichedSpecials;
  };

  // Agrupar precios especiales por ruta
  const specialRouteGroups = useMemo(() => {
    const map = new Map<string, SpecialRouteGroup>();

    filteredSpecials.forEach(item => {
      const key = item.routeId || (item.routeName ? item.routeName : 'UNASSIGNED');
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          routeId: item.routeId,
          routeCode: item.routeCode,
          routeName: item.routeName || (item.routeId ? 'Ruta asignada' : 'Sin ruta asignada'),
          specials: [],
        };
        map.set(key, group);
      }
      group.specials.push(item);
    });

    // Ordenar items alfabéticamente dentro de cada grupo por cliente y presentación
    map.forEach(group => {
      group.specials.sort((a, b) => {
        const c1 = a.customerName.localeCompare(b.customerName, 'es', { sensitivity: 'base' });
        if (c1 !== 0) return c1;
        return a.presentationName.localeCompare(b.presentationName, 'es', { sensitivity: 'base' });
      });
    });

    // Ordenar grupos: Rutas asignadas primero alfabéticamente, no asignados al final
    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (a.key === 'UNASSIGNED' || a.routeName === 'Sin ruta asignada') return 1;
      if (b.key === 'UNASSIGNED' || b.routeName === 'Sin ruta asignada') return -1;
      return a.routeName.localeCompare(b.routeName, 'es', { sensitivity: 'base' });
    });

    return result;
  }, [filteredSpecials]);

  const displayedSpecialGroups = useMemo(() => {
    if (specialRouteFilter === 'ALL') return specialRouteGroups;
    return specialRouteGroups.filter(g => g.key === specialRouteFilter);
  }, [specialRouteGroups, specialRouteFilter]);

  // Si el usuario busca y el cliente está en múltiples rutas, detectar las rutas encontradas
  const multiRouteNotice = useMemo(() => {
    const q = specialSearchQuery.trim().toLowerCase();
    if (!q || filteredSpecials.length <= 1) return null;
    const distinctRoutes = Array.from(new Set(filteredSpecials.map(s => s.routeName || 'Sin ruta asignada')));
    if (distinctRoutes.length > 1) {
      return {
        query: specialSearchQuery.trim(),
        routes: distinctRoutes,
        totalItems: filteredSpecials.length,
      };
    }
    return null;
  }, [filteredSpecials, specialSearchQuery]);

  const registeredDiscounts = [...(discounts.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return <main><PageHeader eyebrow="Reglas comerciales" title={isCreateView ? 'Registrar precios' : 'Precios registrados'} description={isCreateView ? 'Configure listas, versiones y reglas comerciales. El servidor calculará el precio oficial.' : 'Consulte las listas, versiones y reglas comerciales vigentes.'} actions={<button type="button" className="secondary" onClick={() => navigate(isCreateView ? '/pricing/list' : '/pricing')}>{isCreateView ? 'Ver precios registrados' : 'Registrar nuevos precios'}</button>} />
    {showToast && (
      <div className="floating-toast-overlay" role="dialog" aria-modal="true">
        <div className="floating-toast-card">
          <div className="floating-toast-icon">✅</div>
          <div className="floating-toast-body">
            <h3>Datos grabados</h3>
            <p>{toastMessage || 'La versión de precios se guardó exitosamente en borrador.'}</p>
          </div>
          <div className="floating-toast-actions">
            <button type="button" className="primary" onClick={closeToast} autoFocus>
              OK
            </button>
          </div>
        </div>
      </div>
    )}
    {canManage && isCreateView && <>
      <form className="panel inline-form" onSubmit={event => submit(event, () => createList.mutate())}><h2>Nueva lista</h2>
        {listMessage && <div className="alert success wide">✅ {listMessage}</div>}
        <label>Nombre<input required value={listForm.name} onChange={event => setListForm({ ...listForm, name: event.target.value })} /></label>
        <label>Moneda<input required maxLength={3} value={listForm.currencyCode} onChange={event => setListForm({ ...listForm, currencyCode: event.target.value.toUpperCase() })} /></label>
        <button className="primary">Crear lista</button>{createList.error && <div className="alert error wide">{createList.error.message}</div>}
      </form>
      <form className="panel section-panel" onSubmit={event => submit(event, () => createVersion.mutate())}>
        <div className="section-heading">
          <h2>Nueva versión de precios</h2>
        </div>
        <fieldset disabled={createVersion.isPending} style={{ border: 'none', padding: 0, margin: 0 }}>
          <div className="inline-form">
            <label>Lista
              <select value={selectedList} onChange={event => setSelectedList(event.target.value)}>
                <option value="">Seleccionar</option>
                {lists.data?.map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}
              </select>
            </label>
            <label>Vigente desde
              <input type="datetime-local" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={validFrom} onChange={event => setValidFrom(event.target.value)} />
            </label>
          </div>
          <div className="tier-editor">
            {tiers.map((tier, index) => <div className="tier-row" key={index}>
              <label>Presentación
                <select required value={tier.presentationId} onChange={event => updateTier(index, { presentationId: event.target.value })}>
                  <option value="">Seleccionar</option>
                  {presentations.map(item => <option value={item.id} key={item.id}>{item.productName} · {item.name}</option>)}
                </select>
              </label>
              <label>Desde
                <input
                  ref={index === 0 ? desdeInputRef : undefined}
                  type="number"
                  min="1"
                  required
                  placeholder="1"
                  value={tier.minimumBaseUnits}
                  onChange={event => updateTier(index, { minimumBaseUnits: event.target.value === '' ? '' : Number(event.target.value) })}
                />
              </label>
              <label>Hasta
                <input
                  type="number"
                  min="1"
                  placeholder={index === tiers.length - 1 ? 'Sin límite (dejar vacío)' : 'Límite'}
                  value={tier.maximumBaseUnits}
                  onChange={event => updateTier(index, { maximumBaseUnits: event.target.value })}
                />
                {index === tiers.length - 1 && (
                  <small style={{ color: '#0284c7', fontSize: '0.78rem', display: 'block', marginTop: '0.25rem', fontWeight: 500 }}>
                    💡 Dejar vacío si es el último tramo (sin límite)
                  </small>
                )}
              </label>
              <label>Precio unitario
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={tier.unitPrice}
                  onChange={event => updateTier(index, { unitPrice: event.target.value === '' ? '' : Number(event.target.value) })}
                />
              </label>
              {tiers.length > 1 && (
                <button type="button" className="secondary danger-button" onClick={() => setTiers(current => current.filter((_, itemIndex) => itemIndex !== index))}>
                  Quitar
                </button>
              )}
            </div>)}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setTiers(current => [
                ...current,
                {
                  presentationId: current.at(-1)?.presentationId ?? '',
                  minimumBaseUnits: current.at(-1)?.maximumBaseUnits ? Number(current.at(-1)?.maximumBaseUnits) + 1 : '',
                  maximumBaseUnits: '',
                  unitPrice: ''
                }
              ])}
            >
              Agregar tramo
            </button>
            <button className="primary" disabled={!selectedList || createVersion.isPending}>
              {createVersion.isPending ? 'Guardando…' : 'Guardar versión'}
            </button>
          </div>
        </fieldset>
        {createVersion.error && (
          <div className="alert error">
            <div>{createVersion.error.message}</div>
            {createVersion.error.message.includes('El último tramo debe cubrir todas las cantidades superiores') && (
              <div style={{ marginTop: '0.45rem', fontSize: '0.88rem', fontWeight: 500, color: '#991b1b' }}>
                👉 <strong>Solución:</strong> En el último tramo, borre el valor del campo <strong>&quot;Hasta&quot;</strong> y déjelo totalmente vacío para que aplique sin límite superior. Si tiene otro rango de cantidad, presione <strong>&quot;Agregar tramo&quot;</strong>.
              </div>
            )}
          </div>
        )}
      </form>
    </>}
    {!isCreateView && <section className="pricing-list section-panel"><h2>Listas y versiones registradas</h2><p className="muted">Ordenadas desde la versión más reciente.</p><div className="table-wrap pricing-table-wrap"><table><thead><tr><th>Lista</th><th>Versión</th><th>Vigente desde</th><th>Tramos configurados</th><th>Estado</th><th>Opciones</th></tr></thead><tbody>{registeredVersions.map(({ list, version }) => <tr key={version.id}><td><strong>{list.name}</strong><small>{list.code} · {list.currencyCode}</small></td><td>Versión {version.versionNumber}</td><td>{formatDate(version.validFrom)}</td><td>{version.tiers.map(tier => <span className="table-line" key={tier.id}>{tier.presentationName} · {tier.minimumBaseUnits}–{tier.maximumBaseUnits ?? '∞'} · Q{tier.unitPrice.toFixed(2)}</span>)}</td><td><span className={`status ${version.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{version.status}</span></td><td>{canManage && ['DRAFT', 'SCHEDULED'].includes(version.status) && <button className="secondary" onClick={() => activate.mutate(version.id)}>{version.status === 'DRAFT' ? 'Activar' : 'Reprogramar'}</button>}</td></tr>)}</tbody></table>{registeredVersions.length === 0 && <p className="muted">Aún no hay versiones registradas.</p>}</div></section>}
    {canManage && isCreateView && <form className="panel section-panel inline-form" onSubmit={event => {
      event.preventDefault();
      if (!special.customerId) {
        setIsSpecialCustomerOpen(true);
        return;
      }
      createSpecial.mutate();
    }}><h2 className="wide">Registrar precio especial por cliente</h2>
      {specialMessage && <div className="alert success wide">✅ {specialMessage}</div>}
      <div className="searchable-customer-field" ref={specialCustomerPickerRef}>
        <label htmlFor="special-customer-input">Cliente</label>
        <div className="searchable-customer-input-wrap">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            id="special-customer-input"
            type="text"
            role="combobox"
            aria-expanded={isSpecialCustomerOpen}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Buscar por nombre o código..."
            value={specialCustomerSearch}
            onChange={event => {
              const val = event.target.value;
              setSpecialCustomerSearch(val);
              setIsSpecialCustomerOpen(true);
              if (!val) {
                setSpecial(prev => ({ ...prev, customerId: '' }));
              } else if (special.customerId) {
                const currentSel = customers.data?.find(c => c.id === special.customerId);
                if (currentSel && `${currentSel.code} · ${currentSel.name}` !== val) {
                  setSpecial(prev => ({ ...prev, customerId: '' }));
                }
              }
            }}
            onFocus={() => setIsSpecialCustomerOpen(true)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                setIsSpecialCustomerOpen(false);
              } else if (event.key === 'Enter') {
                if (isSpecialCustomerOpen && matchingCustomers.length === 1) {
                  event.preventDefault();
                  const match = matchingCustomers[0];
                  setSpecial(prev => ({ ...prev, customerId: match.id }));
                  setSpecialCustomerSearch(`${match.code} · ${match.name}`);
                  setIsSpecialCustomerOpen(false);
                }
              }
            }}
            style={{
              borderColor: special.customerId ? 'var(--primary)' : undefined,
              backgroundColor: special.customerId ? '#f0fdf4' : undefined
            }}
          />
          {specialCustomerSearch && (
            <button
              type="button"
              className="clear-btn"
              title="Borrar y buscar otro cliente"
              aria-label="Limpiar búsqueda de cliente"
              onClick={() => {
                setSpecialCustomerSearch('');
                setSpecial(prev => ({ ...prev, customerId: '' }));
                setIsSpecialCustomerOpen(true);
              }}
            >
              ✕
            </button>
          )}
        </div>
        <input
          tabIndex={-1}
          required
          aria-hidden="true"
          value={special.customerId}
          onChange={() => {}}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
        />
        {isSpecialCustomerOpen && (
          <div className="customer-matches-dropdown" role="listbox">
            <div className="customer-matches-header">
              <span>{specialCustomerSearch ? 'Coincidencias encontradas' : 'Clientes ordenados por ruta'}</span>
              <span>{matchingCustomers.length} {matchingCustomers.length === 1 ? 'cliente' : 'clientes'} ({matchingCustomerRouteGroups.length} {matchingCustomerRouteGroups.length === 1 ? 'ruta' : 'rutas'})</span>
            </div>
            {matchingCustomerRouteGroups.length > 1 && specialCustomerSearch.trim() && (
              <div style={{ padding: '0.45rem 0.65rem', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600 }}>
                📍 Coincidencias en {matchingCustomerRouteGroups.length} rutas diferentes: cada cliente se muestra separado bajo su ruta correspondiente.
              </div>
            )}
            {matchingCustomers.length === 0 ? (
              <div className="customer-match-empty">
                🔍 Sin coincidencias para &quot;{specialCustomerSearch}&quot;
              </div>
            ) : (
              matchingCustomerRouteGroups.map(grp => (
                <div key={grp.routeName} style={{ marginBottom: '0.35rem' }}>
                  <div style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    color: grp.routeName === 'Sin ruta asignada' ? '#92400e' : '#0369a1',
                    background: grp.routeName === 'Sin ruta asignada' ? '#fef3c7' : '#f0f9ff',
                    borderRadius: '4px',
                    margin: '0.25rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    {grp.routeName === 'Sin ruta asignada' ? '⚠️' : '🚚'} {grp.routeName}
                    <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: 'auto' }}>({grp.customers.length})</span>
                  </div>
                  {grp.customers.map(item => {
                    const isSelected = item.id === special.customerId;
                    const isRouteCustomer = item.customerType === 'PROVISIONAL' || item.customerType === 'OCCASIONAL' || item.registrationState === 'PENDING_REVIEW';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`customer-match-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSpecial(prev => ({ ...prev, customerId: item.id }));
                          setSpecialCustomerSearch(`${item.code} · ${item.name}`);
                          setIsSpecialCustomerOpen(false);
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span className="customer-match-badge">{item.code}</span>
                          <strong>{item.name}</strong>
                          {item.routeName && (
                            <span style={{ fontSize: '0.74rem', color: '#0369a1', background: '#e0f2fe', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              🚚 {item.routeName}
                            </span>
                          )}
                          {item.sellerName && (
                            <span style={{ fontSize: '0.72rem', color: '#0f766e', background: '#ccfbf1', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              👤 {item.sellerName}
                            </span>
                          )}
                          {isRouteCustomer && (
                            <span style={{ fontSize: '0.72rem', color: '#92400e', background: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                              Creado en ruta
                            </span>
                          )}
                        </span>
                        {isSelected && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
        {selectedCustomer && (selectedCustomer.customerType === 'PROVISIONAL' || selectedCustomer.customerType === 'OCCASIONAL' || selectedCustomer.registrationState === 'PENDING_REVIEW') && (
          <div style={{ marginTop: '0.45rem', fontSize: '0.82rem', color: '#065f46', background: '#ecfdf5', padding: '0.45rem 0.75rem', borderRadius: '0.45rem', border: '1px solid #a7f3d0' }}>
            💡 <strong>Cliente registrado en ruta:</strong> Al guardar este precio especial, el sistema validará y promoverá automáticamente al cliente a <strong>Cliente Permanente Activo</strong>.
          </div>
        )}
      </div>
      <label>Presentación<select required value={special.presentationId} onChange={event => setSpecial({ ...special, presentationId: event.target.value })}><option value="">Seleccionar</option>{presentations.map(item => <option value={item.id} key={item.id}>{item.productName} · {item.name}</option>)}</select></label>
      <label>Precio<input type="number" min="0.01" step="0.01" value={special.unitPrice} onChange={event => setSpecial({ ...special, unitPrice: Number(event.target.value) })} /></label>
      <label>Desde<input type="datetime-local" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={special.validFrom} onChange={event => setSpecial({ ...special, validFrom: event.target.value })} /></label>
      <label>Hasta (opcional)<input type="datetime-local" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={special.validTo} onChange={event => setSpecial({ ...special, validTo: event.target.value })} /></label><button className="primary">Guardar precio especial</button>
      {createSpecial.error && <div className="alert error wide">{createSpecial.error.message}</div>}
    </form>}
    {!isCreateView && (canManage || canApprove) && (
      <section className="panel section-panel">
        <div className="section-heading">
          <div>
            <h2>Precios especiales registrados</h2>
            <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
              Clientes ordenados por ruta con precios y condiciones preferenciales
            </span>
          </div>
          <span className="badge" style={{ fontSize: '0.9rem', padding: '0.35rem 0.8rem' }}>
            {enrichedSpecials.length} {enrichedSpecials.length === 1 ? 'precio registrado' : 'precios registrados'}
          </span>
        </div>

        {/* Barra de Filtros y Buscador */}
        <div className="customer-filter-bar">
          <div className="customer-filter-top">
            <div className="searchable-customer-input-wrap" style={{ flex: 1, minWidth: '260px' }}>
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                className="customer-search-input"
                placeholder="Buscar cliente por nombre o presentación..."
                value={specialSearchQuery}
                onChange={e => setSpecialSearchQuery(e.target.value)}
                style={{ width: '100%', margin: 0 }}
              />
              {specialSearchQuery && (
                <button
                  type="button"
                  className="clear-btn"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSpecialSearchQuery('')}
                  style={{ top: '50%' }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="customer-view-toggle">
              <button
                type="button"
                className={`customer-view-btn ${specialViewMode === 'grouped' ? 'active' : ''}`}
                onClick={() => setSpecialViewMode('grouped')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Layers size={14} />
                Agrupado por Ruta
              </button>
              <button
                type="button"
                className={`customer-view-btn ${specialViewMode === 'flat' ? 'active' : ''}`}
                onClick={() => setSpecialViewMode('flat')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <List size={14} />
                Lista Plana
              </button>
            </div>
          </div>

          {/* Píldoras de filtro rápido por ruta */}
          {specialRouteGroups.length > 0 && (
            <div className="customer-filter-pills" style={{ marginTop: '0.65rem' }}>
              <button
                type="button"
                className={`customer-filter-pill ${specialRouteFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSpecialRouteFilter('ALL')}
              >
                Todas las rutas ({filteredSpecials.length})
              </button>
              {specialRouteGroups.map(grp => (
                <button
                  type="button"
                  key={grp.key}
                  className={`customer-filter-pill ${specialRouteFilter === grp.key ? 'active' : ''}`}
                  onClick={() => setSpecialRouteFilter(grp.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {grp.key === 'UNASSIGNED' || grp.routeName === 'Sin ruta asignada' ? (
                    <AlertTriangle size={13} style={{ color: '#b45309' }} />
                  ) : (
                    <Truck size={13} style={{ color: '#0284c7' }} />
                  )}
                  {grp.routeName} · <strong>{grp.specials.length}</strong>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notificación cuando el cliente buscado está en múltiples rutas */}
        {multiRouteNotice && (
          <div style={{
            background: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: '0.65rem',
            padding: '0.75rem 1rem',
            margin: '0.85rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#166534',
            fontSize: '0.9rem'
          }}>
            <span style={{ fontSize: '1.3rem' }}>📍</span>
            <div>
              <strong>Coincidencia en {multiRouteNotice.routes.length} rutas:</strong> El cliente &quot;{multiRouteNotice.query}&quot; tiene precios registrados en <strong>{multiRouteNotice.routes.join(' · ')}</strong>. Se muestran las opciones separadas por ruta a continuación.
            </div>
          </div>
        )}

        {/* Vista Agrupada por Ruta */}
        {specialViewMode === 'grouped' && displayedSpecialGroups.length > 0 && (
          <div className="customer-groups-container" style={{ marginTop: '1rem' }}>
            {displayedSpecialGroups.map(group => {
              const isCollapsed = Boolean(collapsedSpecialGroups[group.key]);
              const isUnassigned = group.key === 'UNASSIGNED' || group.routeName === 'Sin ruta asignada';

              return (
                <article className="route-group-panel" key={group.key}>
                  <div
                    className={`route-group-banner ${isUnassigned ? 'unassigned' : ''}`}
                    onClick={() => toggleSpecialGroup(group.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleSpecialGroup(group.key); }}
                  >
                    <div className="route-group-info">
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: isUnassigned ? '#fef3c7' : '#e0f2fe'
                      }}>
                        {isUnassigned ? <AlertTriangle size={20} style={{ color: '#b45309' }} /> : <Truck size={20} style={{ color: '#0369a1' }} />}
                      </div>
                      <div>
                        <h3 className="route-group-title">
                          {isUnassigned ? 'Clientes Sin Ruta Asignada' : `Ruta ${group.routeName} ${group.routeCode ? `(${group.routeCode})` : ''}`}
                        </h3>
                        <span className="route-group-subtitle">
                          {group.specials.length} {group.specials.length === 1 ? 'precio especial registrado' : 'precios especiales registrados'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        className="badge"
                        style={{
                          background: isUnassigned ? '#fef3c7' : '#e0f2fe',
                          color: isUnassigned ? '#92400e' : '#0369a1',
                          fontWeight: 600,
                        }}
                      >
                        {group.specials.length}
                      </span>
                      {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="table-wrap pricing-table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Ruta</th>
                            <th>Presentación</th>
                            <th>Precio</th>
                            <th>Vigencia</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.specials.map(item => (
                            <tr key={item.id}>
                              <td>
                                <strong>{item.customerName}</strong>
                                {item.customerCode && <small style={{ display: 'block', color: 'var(--muted)' }}>{item.customerCode}</small>}
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  color: isUnassigned ? '#92400e' : '#0369a1',
                                  background: isUnassigned ? '#fef3c7' : '#e0f2fe',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px'
                                }}>
                                  {isUnassigned ? '⚠️' : '🚚'} {item.routeName || 'Sin ruta asignada'}
                                </span>
                              </td>
                              <td>{item.presentationName}</td>
                              <td>
                                <strong style={{ color: 'var(--primary-dark)', fontSize: '1.05rem' }}>
                                  Q{item.unitPrice.toFixed(2)}
                                </strong>
                              </td>
                              <td>
                                {formatDate(item.validFrom)}
                                <small>Hasta: {formatDate(item.validTo)}</small>
                              </td>
                              <td>
                                <span className={`status ${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Vista Plana */}
        {specialViewMode === 'flat' && (
          <div className="table-wrap pricing-table-wrap" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Ruta</th>
                  <th>Presentación</th>
                  <th>Precio</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpecials.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.customerName}</strong>
                      {item.customerCode && <small style={{ display: 'block', color: 'var(--muted)' }}>{item.customerCode}</small>}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: item.routeName ? '#0369a1' : '#92400e',
                        background: item.routeName ? '#e0f2fe' : '#fef3c7',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px'
                      }}>
                        {item.routeName ? '🚚' : '⚠️'} {item.routeName || 'Sin ruta asignada'}
                      </span>
                    </td>
                    <td>{item.presentationName}</td>
                    <td>
                      <strong style={{ color: 'var(--primary-dark)', fontSize: '1.05rem' }}>
                        Q{item.unitPrice.toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      {formatDate(item.validFrom)}
                      <small>Hasta: {formatDate(item.validTo)}</small>
                    </td>
                    <td>
                      <span className={`status ${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredSpecials.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
            {specialSearchQuery ? (
              <p>🔍 No se encontraron precios especiales para &quot;<strong>{specialSearchQuery}</strong>&quot;.</p>
            ) : (
              <p>Aún no hay precios especiales registrados.</p>
            )}
          </div>
        )}
      </section>
    )}
    {canRequestDiscount && isCreateView && <form className="panel section-panel form-grid" onSubmit={event => submit(event, () => requestDiscount.mutate())}><h2 className="wide">Solicitar descuento extraordinario</h2>
      {discountMessage && <div className="alert success wide">✅ {discountMessage}</div>}
      <label>Cliente<select required value={discount.customerId} onChange={event => setDiscount({ ...discount, customerId: event.target.value })}><option value="">Seleccionar</option>{customers.data?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Presentación<select required value={discount.presentationId} onChange={event => setDiscount({ ...discount, presentationId: event.target.value })}><option value="">Seleccionar</option>{presentations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Cantidad base<input type="number" min="1" value={discount.quantityBaseUnits} onChange={event => setDiscount({ ...discount, quantityBaseUnits: Number(event.target.value) })} /></label><label>Precio solicitado<input type="number" min="0.01" step="0.01" value={discount.requestedPrice} onChange={event => setDiscount({ ...discount, requestedPrice: Number(event.target.value) })} /></label>
      <label className="wide">Motivo<textarea required value={discount.reason} onChange={event => setDiscount({ ...discount, reason: event.target.value })} /></label><label>Expira<input type="datetime-local" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={discount.expiresAt} onChange={event => setDiscount({ ...discount, expiresAt: event.target.value })} /></label><button className="primary">Solicitar autorización</button>
      {requestDiscount.error && <div className="alert error wide">{requestDiscount.error.message}</div>}
    </form>}
    {!isCreateView && (canApprove || canRequestDiscount) && <section className="panel section-panel"><h2>Solicitudes de descuento registradas</h2><div className="table-wrap pricing-table-wrap"><table><thead><tr><th>Cliente</th><th>Presentación</th><th>Precio normal</th><th>Precio solicitado</th><th>Solicitante y fecha</th><th>Motivo</th><th>Estado / opciones</th></tr></thead><tbody>{registeredDiscounts.map(item => <tr key={item.id}><td>{item.customerName}</td><td>{item.presentationName}</td><td>Q{item.normalPrice.toFixed(2)}</td><td>Q{item.requestedPrice.toFixed(2)}</td><td>{item.requesterUsername}<small>{formatDate(item.createdAt)}</small></td><td>{item.reason}</td><td><span className={`status ${item.status === 'APPROVED' ? 'active' : 'inactive'}`}>{item.status}</span>{canApprove && item.status === 'REQUESTED' && <div className="row-actions"><button className="primary" onClick={() => decide.mutate({ id: item.id, decision: 'APPROVED' })}>Aprobar</button><button className="secondary" onClick={() => decide.mutate({ id: item.id, decision: 'REJECTED' })}>Rechazar</button></div>}</td></tr>)}</tbody></table>{registeredDiscounts.length === 0 && <p className="muted">Aún no hay solicitudes registradas.</p>}</div></section>}
  </main>;
}
