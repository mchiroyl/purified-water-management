import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';

type Presentation = {
  id: string;
  code: string;
  name: string;
  presentationType: string;
  contentQuantity: number;
  contentUnit: string;
  unitCode: string;
  conversionFactor: number;
  active: boolean;
};

const DEFAULT_UNITS = ['ML', 'L', 'OZ', 'GALON'];

/** Selector de unidad con botón "+" para agregar unidades personalizadas. */
function ContentUnitSelector({
  value,
  onChange,
  extraUnits,
  onAddUnit,
}: {
  value: string;
  onChange: (v: string) => void;
  extraUnits: string[];
  onAddUnit: (u: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newUnit, setNewUnit] = useState('');

  const handleAdd = () => {
    const trimmed = newUnit.trim().toUpperCase();
    if (trimmed && !DEFAULT_UNITS.includes(trimmed) && !extraUnits.includes(trimmed)) {
      onAddUnit(trimmed);
    }
    if (trimmed) onChange(trimmed);
    setNewUnit('');
    setAdding(false);
  };

  const allUnits = [...DEFAULT_UNITS, ...extraUnits];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }}>
        {allUnits.map(u => (
          <option key={u} value={u}>{u === 'GALON' ? 'GALÓN' : u}</option>
        ))}
      </select>

      {!adding && (
        <button
          type="button"
          title="Agregar unidad personalizada"
          onClick={() => setAdding(true)}
          style={{
            flexShrink: 0, width: '2rem', height: '2rem', borderRadius: '50%',
            border: '1.5px solid var(--color-primary, #0d6efd)',
            background: 'transparent', color: 'var(--color-primary, #0d6efd)',
            fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      )}

      {adding && (
        <>
          <input
            autoFocus
            placeholder="Ej.: G"
            value={newUnit}
            onChange={e => setNewUnit(e.target.value.toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
              if (e.key === 'Escape') { setAdding(false); setNewUnit(''); }
            }}
            style={{ width: '6rem' }}
          />
          <button
            type="button"
            onClick={handleAdd}
            style={{
              flexShrink: 0, padding: '0.25rem 0.6rem', borderRadius: '0.375rem',
              border: '1.5px solid var(--color-primary, #0d6efd)',
              background: 'var(--color-primary, #0d6efd)', color: '#fff',
              cursor: 'pointer', fontSize: '0.8rem',
            }}
          >OK</button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewUnit(''); }}
            style={{
              flexShrink: 0, padding: '0.25rem 0.6rem', borderRadius: '0.375rem',
              border: '1.5px solid #999', background: 'transparent', color: '#666',
              cursor: 'pointer', fontSize: '0.8rem',
            }}
          >✕</button>
        </>
      )}
    </div>
  );
}

export function PresentationCatalogPage({ view = 'create' }: { view?: 'create' | 'list' }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Presentation | null>(null);
  const [presentationType, setPresentationType] = useState('BOTELLA');
  const [contentQuantity, setContentQuantity] = useState(600);
  const [contentUnit, setContentUnit] = useState('ML');
  const [conversionFactor, setConversionFactor] = useState(1);
  const [extraUnits, setExtraUnits] = useState<string[]>([]);

  const units = useQuery({
    queryKey: ['units-of-measure'],
    queryFn: () => apiRequest<{ code: string }[]>('/units-of-measure'),
  });

  useEffect(() => {
    if (units.data) setExtraUnits(units.data.map(item => item.code).filter(code => !DEFAULT_UNITS.includes(code)));
  }, [units.data]);

  const presentations = useQuery({
    queryKey: ['presentation-catalog', query],
    queryFn: () => apiRequest<Presentation[]>(`/presentation-catalog?query=${encodeURIComponent(query)}`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['presentation-catalog'] });

  const reset = () => {
    setEditing(null);
    setPresentationType('BOTELLA');
    setContentQuantity(600);
    setContentUnit('ML');
    setConversionFactor(1);
  };

  const save = useMutation({
    mutationFn: () =>
      apiRequest<Presentation>(
        editing ? `/presentation-catalog/${editing.id}` : '/presentation-catalog',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({ presentationType, contentQuantity, contentUnit, unitCode: presentationType, conversionFactor }),
        },
      ),
    onSuccess: async () => { reset(); await refresh(); },
  });

  const status = useMutation({
    mutationFn: (item: Presentation) =>
      apiRequest<Presentation>(`/presentation-catalog/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/presentation-catalog/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const edit = (item: Presentation) => {
    setEditing(item);
    setPresentationType(item.presentationType);
    setContentQuantity(item.contentQuantity);
    setContentUnit(item.contentUnit);
    setConversionFactor(item.conversionFactor);
  };

  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };
  const addUnit = useMutation({
    mutationFn: (code: string) => apiRequest<{ code: string }>('/units-of-measure', {
      method: 'POST', body: JSON.stringify({ code, name: code, decimalPlaces: 3 }),
    }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['units-of-measure'] }); },
  });
  const handleAddUnit = (u: string) => { setExtraUnits(prev => prev.includes(u) ? prev : [...prev, u]); addUnit.mutate(u); };

  return (
    <main className={`presentation-page ${view}`}>
      <PageHeader
        eyebrow="Catálogo"
        title="Presentaciones"
        description="Cree tamaños y empaques una sola vez para luego seleccionarlos al registrar productos."
        actions={
          <button
            type="button"
            className="secondary"
            onClick={() => navigate(view === 'create' ? '/presentations/list' : '/presentations')}
          >
            {view === 'create' ? 'Ver presentaciones' : 'Nueva presentación'}
          </button>
        }
      />

      {view === 'create' && (
        <form className="panel catalog-form presentation-form" onSubmit={submit}>
          <h2>Nueva presentación</h2>
          <div className="form-grid compact-grid">
            <label>
              Tipo de envase
              <input required value={presentationType} onChange={e => setPresentationType(e.target.value.toUpperCase())} />
            </label>
            <p className="field-hint">Código y unidad de inventario: se asignan automáticamente.</p>
            <label>
              Contenido
              <input required type="number" min="0.001" step="0.001" value={contentQuantity} onChange={e => setContentQuantity(Number(e.target.value))} />
            </label>
            <label>
              Unidad del contenido
              <ContentUnitSelector value={contentUnit} onChange={setContentUnit} extraUnits={extraUnits} onAddUnit={handleAddUnit} />
            </label>
            <label>
              Factor de inventario
              <input required type="number" min="0.000001" step="0.000001" value={conversionFactor} onChange={e => setConversionFactor(Number(e.target.value))} />
            </label>
          </div>
          <p className="field-hint">Ejemplo: BOTELLA de 600 ML; se controla automáticamente como BOTELLA.</p>
          <div className="form-actions">
            <button className="primary" disabled={save.isPending}>Guardar presentación</button>
          </div>
          {save.error && <div className="alert error">{save.error.message}</div>}
        </form>
      )}

      {view === 'list' && (
        <section className="catalog-list" aria-label="Presentaciones registradas">
          <label>
            Filtrar presentaciones
            <input value={query} placeholder="Ej.: botella" onChange={e => setQuery(e.target.value)} />
          </label>
          {presentations.data && presentations.data.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th><th>Tipo</th><th>Contenido</th>
                    <th>Inventario</th><th>Factor</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {presentations.data.map(item => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.presentationType}</td>
                      <td>{item.contentQuantity} {item.contentUnit}</td>
                      <td>{item.unitCode}</td>
                      <td>{item.conversionFactor}</td>
                      <td><span className={`status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="secondary" onClick={() => edit(item)}>Modificar</button>
                          <button className="secondary" onClick={() => status.mutate(item)}>{item.active ? 'Desactivar' : 'Activar'}</button>
                          <button className="secondary danger-button" onClick={() => { if (confirm(`¿Eliminar ${item.name}?`)) remove.mutate(item.id); }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {presentations.data?.length === 0 && <p className="muted">No hay presentaciones registradas.</p>}
        </section>
      )}

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submit} aria-modal="true" role="dialog" aria-labelledby="modify-presentation-title">
            <h2 id="modify-presentation-title">Modificar presentación</h2>
            <p className="muted">Código: {editing.code}</p>
            <div className="form-grid compact-grid">
              <label>
                Tipo de envase
                <input required value={presentationType} onChange={e => setPresentationType(e.target.value.toUpperCase())} />
              </label>
              <label>
                Contenido
                <input required type="number" min="0.001" step="0.001" value={contentQuantity} onChange={e => setContentQuantity(Number(e.target.value))} />
              </label>
              <label>
                Unidad del contenido
                <ContentUnitSelector value={contentUnit} onChange={setContentUnit} extraUnits={extraUnits} onAddUnit={handleAddUnit} />
              </label>
              <label>
                Factor de inventario
                <input required type="number" min="0.000001" step="0.000001" value={conversionFactor} onChange={e => setConversionFactor(Number(e.target.value))} />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={reset}>Cancelar</button>
              <button className="primary" disabled={save.isPending}>Guardar cambios</button>
            </div>
            {save.error && <div className="alert error">{save.error.message}</div>}
          </form>
        </div>
      )}
    </main>
  );
}
