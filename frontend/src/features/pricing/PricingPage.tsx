import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../app/PageHeader';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/apiClient';
import { calendarOnlyProps, currentMonthDateTimeBounds } from '../../utils/dateInput';

type Tier = { id: string; presentationId: string; presentationCode: string; presentationName: string; minimumBaseUnits: number; maximumBaseUnits?: number; unitPrice: number };
type Version = { id: string; versionNumber: number; validFrom: string; validTo?: string; status: string; tiers: Tier[] };
type PriceList = { id: string; code: string; name: string; status: string; currencyCode: string; versions: Version[] };
type Product = { id: string; name: string; presentations: Array<{ id: string; code: string; name: string; active: boolean }> };
type Customer = { id: string; code: string; name: string };
type Special = { id: string; customerName: string; presentationName: string; unitPrice: number; validFrom: string; validTo?: string; status: string };
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
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers'), enabled: canManage || canRequestDiscount });
  const specials = useQuery({ queryKey: ['pricing', 'specials'], queryFn: () => apiRequest<Special[]>('/pricing/special-prices'), enabled: canManage || canApprove });
  const discounts = useQuery({ queryKey: ['pricing', 'discounts'], queryFn: () => apiRequest<Discount[]>('/pricing/discounts'), enabled: canApprove || canRequestDiscount });
  const presentations = products.data?.flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, productName: product.name }))) ?? [];
  const [listForm, setListForm] = useState({ name: '', currencyCode: 'GTQ' });
  const [selectedList, setSelectedList] = useState('');
  const [validFrom, setValidFrom] = useState(localDateTime());
  const [tiers, setTiers] = useState<DraftTier[]>([emptyTier()]);
  const [special, setSpecial] = useState({ customerId: '', presentationId: '', unitPrice: 0, validFrom: localDateTime(), validTo: '' });
  const [discount, setDiscount] = useState({ customerId: '', presentationId: '', quantityBaseUnits: 1, requestedPrice: 0, reason: '', expiresAt: localDateTime(2) });
  const [versionSuccessMessage, setVersionSuccessMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desdeInputRef = useRef<HTMLInputElement>(null);
  const [listMessage, setListMessage] = useState('');
  const [specialMessage, setSpecialMessage] = useState('');
  const [discountMessage, setDiscountMessage] = useState('');
  useEffect(() => { if (!selectedList && lists.data?.[0]) setSelectedList(lists.data[0].id); }, [lists.data, selectedList]);
  const refresh = () => void client.invalidateQueries({ queryKey: ['pricing'] });

  const closeToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setShowToast(false);
    setTimeout(() => {
      desdeInputRef.current?.focus();
    }, 50);
  };

  const triggerSavedToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setShowToast(true);

    // Limpiar campos inmediatamente para evitar doble registro
    setTiers([emptyTier()]);
    setValidFrom(localDateTime());

    // Posicionar el cursor en el campo 'desde'
    setTimeout(() => {
      desdeInputRef.current?.focus();
    }, 50);

    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
      desdeInputRef.current?.focus();
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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
      setVersionSuccessMessage(msg);
      triggerSavedToast(msg);
    }
  });
  const activate = useMutation({ mutationFn: (id: string) => apiRequest<PriceList>(`/pricing/versions/${id}/activate`, { method: 'POST' }), onSuccess: refresh });
  const createSpecial = useMutation({
    mutationFn: () => apiRequest<Special>('/pricing/special-prices', { method: 'POST', body: JSON.stringify({ ...special, validFrom: new Date(special.validFrom).toISOString(), validTo: special.validTo ? new Date(special.validTo).toISOString() : null }) }),
    onSuccess: () => {
      setSpecial({ customerId: '', presentationId: '', unitPrice: 0, validFrom: localDateTime(), validTo: '' });
      setSpecialMessage('¡Precio especial por cliente guardado exitosamente!');
      refresh();
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
  const registeredSpecials = [...(specials.data ?? [])].sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
  const registeredDiscounts = [...(discounts.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return <main><PageHeader eyebrow="Reglas comerciales" title={isCreateView ? 'Registrar precios' : 'Precios registrados'} description={isCreateView ? 'Configure listas, versiones y reglas comerciales. El servidor calculará el precio oficial.' : 'Consulte las listas, versiones y reglas comerciales vigentes.'} actions={<button type="button" className="secondary" onClick={() => navigate(isCreateView ? '/pricing/list' : '/pricing')}>{isCreateView ? 'Ver precios registrados' : 'Registrar nuevos precios'}</button>} />
    {showToast && (
      <div className="floating-toast-overlay" role="dialog" aria-modal="true" onClick={closeToast}>
        <div className="floating-toast-card" onClick={event => event.stopPropagation()}>
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
        {versionSuccessMessage && (
          <div className="alert success wide" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <span>✅ {versionSuccessMessage}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => navigate('/pricing/list')}>
                Ver precios registrados
              </button>
            </div>
          </div>
        )}
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
                  placeholder="Sin límite"
                  value={tier.maximumBaseUnits}
                  onChange={event => updateTier(index, { maximumBaseUnits: event.target.value })}
                />
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
        {createVersion.error && <div className="alert error">{createVersion.error.message}</div>}
      </form>
    </>}
    {!isCreateView && <section className="pricing-list section-panel"><h2>Listas y versiones registradas</h2><p className="muted">Ordenadas desde la versión más reciente.</p><div className="table-wrap pricing-table-wrap"><table><thead><tr><th>Lista</th><th>Versión</th><th>Vigente desde</th><th>Tramos configurados</th><th>Estado</th><th>Opciones</th></tr></thead><tbody>{registeredVersions.map(({ list, version }) => <tr key={version.id}><td><strong>{list.name}</strong><small>{list.code} · {list.currencyCode}</small></td><td>Versión {version.versionNumber}</td><td>{formatDate(version.validFrom)}</td><td>{version.tiers.map(tier => <span className="table-line" key={tier.id}>{tier.presentationName} · {tier.minimumBaseUnits}–{tier.maximumBaseUnits ?? '∞'} · Q{tier.unitPrice.toFixed(2)}</span>)}</td><td><span className={`status ${version.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{version.status}</span></td><td>{canManage && ['DRAFT', 'SCHEDULED'].includes(version.status) && <button className="secondary" onClick={() => activate.mutate(version.id)}>{version.status === 'DRAFT' ? 'Activar' : 'Reprogramar'}</button>}</td></tr>)}</tbody></table>{registeredVersions.length === 0 && <p className="muted">Aún no hay versiones registradas.</p>}</div></section>}
    {canManage && isCreateView && <form className="panel section-panel inline-form" onSubmit={event => submit(event, () => createSpecial.mutate())}><h2 className="wide">Registrar precio especial por cliente</h2>
      {specialMessage && <div className="alert success wide">✅ {specialMessage}</div>}
      <label>Cliente<select required value={special.customerId} onChange={event => setSpecial({ ...special, customerId: event.target.value })}><option value="">Seleccionar</option>{customers.data?.map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Presentación<select required value={special.presentationId} onChange={event => setSpecial({ ...special, presentationId: event.target.value })}><option value="">Seleccionar</option>{presentations.map(item => <option value={item.id} key={item.id}>{item.productName} · {item.name}</option>)}</select></label>
      <label>Precio<input type="number" min="0.01" step="0.01" value={special.unitPrice} onChange={event => setSpecial({ ...special, unitPrice: Number(event.target.value) })} /></label>
      <label>Desde<input type="datetime-local" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={special.validFrom} onChange={event => setSpecial({ ...special, validFrom: event.target.value })} /></label>
      <label>Hasta (opcional)<input type="datetime-local" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={special.validTo} onChange={event => setSpecial({ ...special, validTo: event.target.value })} /></label><button className="primary">Guardar precio especial</button>
      {createSpecial.error && <div className="alert error wide">{createSpecial.error.message}</div>}
    </form>}
    {!isCreateView && (canManage || canApprove) && <section className="panel section-panel"><h2>Precios especiales registrados</h2><div className="table-wrap pricing-table-wrap"><table><thead><tr><th>Cliente</th><th>Presentación</th><th>Precio</th><th>Vigencia</th><th>Estado</th></tr></thead><tbody>{registeredSpecials.map(item => <tr key={item.id}><td>{item.customerName}</td><td>{item.presentationName}</td><td>Q{item.unitPrice.toFixed(2)}</td><td>{formatDate(item.validFrom)}<small>Hasta: {formatDate(item.validTo)}</small></td><td><span className={`status ${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{item.status}</span></td></tr>)}</tbody></table>{registeredSpecials.length === 0 && <p className="muted">Aún no hay precios especiales registrados.</p>}</div></section>}
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
