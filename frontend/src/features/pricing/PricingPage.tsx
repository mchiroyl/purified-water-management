import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type Tier = { id: string; presentationId: string; presentationCode: string; presentationName: string; minimumBaseUnits: number; maximumBaseUnits?: number; unitPrice: number };
type Version = { id: string; versionNumber: number; validFrom: string; validTo?: string; status: string; tiers: Tier[] };
type PriceList = { id: string; code: string; name: string; status: string; currencyCode: string; versions: Version[] };
type Product = { id: string; name: string; presentations: Array<{ id: string; code: string; name: string; active: boolean }> };
type Customer = { id: string; code: string; name: string };
type Special = { id: string; customerName: string; presentationName: string; unitPrice: number; validFrom: string; validTo?: string; status: string };
type Discount = { id: string; requesterUsername: string; customerName: string; presentationName: string; normalPrice: number; requestedPrice: number; reason: string; status: string; expiresAt: string };
type DraftTier = { presentationId: string; minimumBaseUnits: number; maximumBaseUnits: string; unitPrice: number };

function localDateTime(hoursAhead = 0): string {
  const date = new Date(Date.now() + hoursAhead * 3_600_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function PricingPage({ canManage, canApprove, canRequestDiscount }: { canManage: boolean; canApprove: boolean; canRequestDiscount: boolean }) {
  const client = useQueryClient();
  const lists = useQuery({ queryKey: ['pricing', 'lists'], queryFn: () => apiRequest<PriceList[]>('/pricing/lists') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canManage || canRequestDiscount });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers'), enabled: canManage || canRequestDiscount });
  const specials = useQuery({ queryKey: ['pricing', 'specials'], queryFn: () => apiRequest<Special[]>('/pricing/special-prices'), enabled: canManage || canApprove });
  const discounts = useQuery({ queryKey: ['pricing', 'discounts'], queryFn: () => apiRequest<Discount[]>('/pricing/discounts'), enabled: canApprove || canRequestDiscount });
  const presentations = products.data?.flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, productName: product.name }))) ?? [];
  const [listForm, setListForm] = useState({ code: '', name: '', currencyCode: 'GTQ' });
  const [selectedList, setSelectedList] = useState('');
  const [validFrom, setValidFrom] = useState(localDateTime());
  const [tiers, setTiers] = useState<DraftTier[]>([{ presentationId: '', minimumBaseUnits: 1, maximumBaseUnits: '', unitPrice: 0 }]);
  const [special, setSpecial] = useState({ customerId: '', presentationId: '', unitPrice: 0, validFrom: localDateTime(), validTo: '' });
  const [discount, setDiscount] = useState({ customerId: '', presentationId: '', quantityBaseUnits: 1, requestedPrice: 0, reason: '', expiresAt: localDateTime(2) });
  useEffect(() => { if (!selectedList && lists.data?.[0]) setSelectedList(lists.data[0].id); }, [lists.data, selectedList]);
  const refresh = () => void client.invalidateQueries({ queryKey: ['pricing'] });
  const createList = useMutation({ mutationFn: () => apiRequest<PriceList>('/pricing/lists', { method: 'POST', body: JSON.stringify(listForm) }), onSuccess: data => { setListForm({ code: '', name: '', currencyCode: 'GTQ' }); setSelectedList(data.id); refresh(); } });
  const createVersion = useMutation({ mutationFn: () => apiRequest<PriceList>(`/pricing/lists/${selectedList}/versions`, { method: 'POST', body: JSON.stringify({ validFrom: new Date(validFrom).toISOString(), tiers: tiers.map(item => ({ ...item, maximumBaseUnits: item.maximumBaseUnits === '' ? null : Number(item.maximumBaseUnits) })) }) }), onSuccess: refresh });
  const activate = useMutation({ mutationFn: (id: string) => apiRequest<PriceList>(`/pricing/versions/${id}/activate`, { method: 'POST' }), onSuccess: refresh });
  const createSpecial = useMutation({ mutationFn: () => apiRequest<Special>('/pricing/special-prices', { method: 'POST', body: JSON.stringify({ ...special, validFrom: new Date(special.validFrom).toISOString(), validTo: special.validTo ? new Date(special.validTo).toISOString() : null }) }), onSuccess: () => { setSpecial({ customerId: '', presentationId: '', unitPrice: 0, validFrom: localDateTime(), validTo: '' }); refresh(); } });
  const requestDiscount = useMutation({ mutationFn: () => apiRequest<Discount>('/pricing/discounts', { method: 'POST', body: JSON.stringify({ ...discount, expiresAt: new Date(discount.expiresAt).toISOString() }) }), onSuccess: () => { setDiscount({ customerId: '', presentationId: '', quantityBaseUnits: 1, requestedPrice: 0, reason: '', expiresAt: localDateTime(2) }); refresh(); } });
  const decide = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => apiRequest<Discount>(`/pricing/discounts/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }), onSuccess: refresh });
  const submit = (event: FormEvent, action: () => void) => { event.preventDefault(); action(); };
  const updateTier = (index: number, patch: Partial<DraftTier>) => setTiers(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  return <main><p className="eyebrow">Reglas comerciales</p><h1>Precios y mayoreo</h1>
    <p className="muted">Los precios se versionan y el servidor vuelve a calcular cada operación.</p>
    {canManage && <>
      <form className="panel inline-form" onSubmit={event => submit(event, () => createList.mutate())}><h2>Nueva lista</h2>
        <label>Código<input required value={listForm.code} onChange={event => setListForm({ ...listForm, code: event.target.value })} /></label>
        <label>Nombre<input required value={listForm.name} onChange={event => setListForm({ ...listForm, name: event.target.value })} /></label>
        <label>Moneda<input required maxLength={3} value={listForm.currencyCode} onChange={event => setListForm({ ...listForm, currencyCode: event.target.value.toUpperCase() })} /></label>
        <button className="primary">Crear lista</button>{createList.error && <div className="alert error wide">{createList.error.message}</div>}
      </form>
      <form className="panel section-panel" onSubmit={event => submit(event, () => createVersion.mutate())}><h2>Nueva versión de precios</h2>
        <div className="inline-form"><label>Lista<select value={selectedList} onChange={event => setSelectedList(event.target.value)}><option value="">Seleccionar</option>{lists.data?.map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label>Vigente desde<input type="datetime-local" value={validFrom} onChange={event => setValidFrom(event.target.value)} /></label></div>
        <div className="tier-editor">{tiers.map((tier, index) => <div className="tier-row" key={index}>
          <label>Presentación<select required value={tier.presentationId} onChange={event => updateTier(index, { presentationId: event.target.value })}><option value="">Seleccionar</option>{presentations.map(item => <option value={item.id} key={item.id}>{item.productName} · {item.name}</option>)}</select></label>
          <label>Desde<input type="number" min="1" value={tier.minimumBaseUnits} onChange={event => updateTier(index, { minimumBaseUnits: Number(event.target.value) })} /></label>
          <label>Hasta<input type="number" min="1" placeholder="Sin límite" value={tier.maximumBaseUnits} onChange={event => updateTier(index, { maximumBaseUnits: event.target.value })} /></label>
          <label>Precio unitario<input type="number" min="0.01" step="0.01" value={tier.unitPrice} onChange={event => updateTier(index, { unitPrice: Number(event.target.value) })} /></label>
          {tiers.length > 1 && <button type="button" className="secondary danger-button" onClick={() => setTiers(current => current.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>}
        </div>)}</div>
        <div className="form-actions"><button type="button" className="secondary" onClick={() => setTiers(current => [...current, { presentationId: current.at(-1)?.presentationId ?? '', minimumBaseUnits: 1, maximumBaseUnits: '', unitPrice: 0 }])}>Agregar tramo</button><button className="primary" disabled={!selectedList}>Guardar versión</button></div>
        {createVersion.error && <div className="alert error">{createVersion.error.message}</div>}
      </form>
    </>}
    <section className="pricing-list section-panel">{lists.data?.map(list => <article className="panel" key={list.id}><div className="section-heading"><div><h2>{list.name}</h2><span>{list.code} · {list.currencyCode}</span></div><span className="status active">{list.status}</span></div>
      {list.versions.length === 0 && <p className="muted">Sin versiones.</p>}{list.versions.map(version => <div className="version-block" key={version.id}><div className="section-heading"><strong>Versión {version.versionNumber} · {version.status}</strong>{canManage && ['DRAFT', 'SCHEDULED'].includes(version.status) && <button className="secondary" onClick={() => activate.mutate(version.id)}>{version.status === 'DRAFT' ? 'Activar' : 'Reprogramar'}</button>}</div>
        {version.tiers.map(tier => <span className="tier-summary" key={tier.id}>{tier.presentationName} · {tier.minimumBaseUnits}–{tier.maximumBaseUnits ?? '∞'} · Q{tier.unitPrice.toFixed(2)}</span>)}</div>)}</article>)}</section>
    {canManage && <form className="panel section-panel inline-form" onSubmit={event => submit(event, () => createSpecial.mutate())}><h2 className="wide">Precio especial por cliente</h2>
      <label>Cliente<select required value={special.customerId} onChange={event => setSpecial({ ...special, customerId: event.target.value })}><option value="">Seleccionar</option>{customers.data?.map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Presentación<select required value={special.presentationId} onChange={event => setSpecial({ ...special, presentationId: event.target.value })}><option value="">Seleccionar</option>{presentations.map(item => <option value={item.id} key={item.id}>{item.productName} · {item.name}</option>)}</select></label>
      <label>Precio<input type="number" min="0.01" step="0.01" value={special.unitPrice} onChange={event => setSpecial({ ...special, unitPrice: Number(event.target.value) })} /></label>
      <label>Desde<input type="datetime-local" value={special.validFrom} onChange={event => setSpecial({ ...special, validFrom: event.target.value })} /></label>
      <label>Hasta (opcional)<input type="datetime-local" value={special.validTo} onChange={event => setSpecial({ ...special, validTo: event.target.value })} /></label><button className="primary">Guardar precio especial</button>
      {createSpecial.error && <div className="alert error wide">{createSpecial.error.message}</div>}
    </form>}
    {(canManage || canApprove) && specials.data && <section className="panel section-panel"><h2>Precios especiales vigentes</h2><div className="data-list">{specials.data.map(item => <div className="data-row" key={item.id}><strong>{item.customerName} · {item.presentationName}</strong><span>Q{item.unitPrice.toFixed(2)} · {item.status}</span></div>)}</div></section>}
    {canRequestDiscount && <form className="panel section-panel form-grid" onSubmit={event => submit(event, () => requestDiscount.mutate())}><h2 className="wide">Solicitar descuento extraordinario</h2>
      <label>Cliente<select required value={discount.customerId} onChange={event => setDiscount({ ...discount, customerId: event.target.value })}><option value="">Seleccionar</option>{customers.data?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Presentación<select required value={discount.presentationId} onChange={event => setDiscount({ ...discount, presentationId: event.target.value })}><option value="">Seleccionar</option>{presentations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Cantidad base<input type="number" min="1" value={discount.quantityBaseUnits} onChange={event => setDiscount({ ...discount, quantityBaseUnits: Number(event.target.value) })} /></label><label>Precio solicitado<input type="number" min="0.01" step="0.01" value={discount.requestedPrice} onChange={event => setDiscount({ ...discount, requestedPrice: Number(event.target.value) })} /></label>
      <label className="wide">Motivo<textarea required value={discount.reason} onChange={event => setDiscount({ ...discount, reason: event.target.value })} /></label><label>Expira<input type="datetime-local" value={discount.expiresAt} onChange={event => setDiscount({ ...discount, expiresAt: event.target.value })} /></label><button className="primary">Solicitar autorización</button>
      {requestDiscount.error && <div className="alert error wide">{requestDiscount.error.message}</div>}
    </form>}
    {(canApprove || canRequestDiscount) && <section className="panel section-panel"><h2>Solicitudes de descuento</h2><div className="data-list">{discounts.data?.map(item => <article className="data-row" key={item.id}><div><strong>{item.customerName} · {item.presentationName}</strong><span>{item.requesterUsername} · Q{item.normalPrice.toFixed(2)} → Q{item.requestedPrice.toFixed(2)}</span><small>{item.reason}</small></div><div className="row-actions"><span className={`status ${item.status === 'APPROVED' ? 'active' : 'inactive'}`}>{item.status}</span>{canApprove && item.status === 'REQUESTED' && <><button className="primary" onClick={() => decide.mutate({ id: item.id, decision: 'APPROVED' })}>Aprobar</button><button className="secondary" onClick={() => decide.mutate({ id: item.id, decision: 'REJECTED' })}>Rechazar</button></>}</div></article>)}</div></section>}
  </main>;
}
