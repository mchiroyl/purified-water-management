import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type Presentation = {
  id: string;
  code: string;
  name: string;
  unitCode: string;
  conversionFactor: number;
  active: boolean;
};

type Product = {
  id: string;
  code: string;
  name: string;
  description: string;
  baseUnitCode: string;
  active: boolean;
  controlsInventory: boolean;
  presentations: Presentation[];
};

type PresentationDraft = Omit<Presentation, 'id' | 'active'>;

const emptyPresentation = (): PresentationDraft => ({ code: '', name: '', unitCode: 'BOTELLA', conversionFactor: 1 });

export function ProductCatalogPage() {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products') });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseUnitCode, setBaseUnitCode] = useState('BOTELLA');
  const [controlsInventory, setControlsInventory] = useState(true);
  const [presentations, setPresentations] = useState<PresentationDraft[]>([emptyPresentation()]);

  const createProduct = useMutation({
    mutationFn: () => apiRequest<Product>('/products', {
      method: 'POST',
      body: JSON.stringify({ code, name, description, baseUnitCode, controlsInventory, presentations })
    }),
    onSuccess: async () => {
      setCode(''); setName(''); setDescription(''); setBaseUnitCode('BOTELLA'); setControlsInventory(true);
      setPresentations([emptyPresentation()]);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  const changeStatus = useMutation({
    mutationFn: (product: Product) => apiRequest<Product>(`/products/${product.id}/status`, {
      method: 'PATCH', body: JSON.stringify({ active: !product.active })
    }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['products'] })
  });

  function updatePresentation(index: number, field: keyof PresentationDraft, value: string | number) {
    setPresentations(current => current.map((item, position) => position === index ? { ...item, [field]: value } : item));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    createProduct.mutate();
  }

  return (
    <main>
      <p className="eyebrow">Catálogo</p>
      <h1>Productos y presentaciones</h1>
      <p className="muted">Cada presentación conserva su conversión oficial a la unidad base del producto.</p>

      <form className="panel catalog-form" onSubmit={submit}>
        <h2>Nuevo producto</h2>
        <div className="form-grid compact-grid">
          <label>Código<input required value={code} onChange={event => setCode(event.target.value)} /></label>
          <label>Nombre<input required value={name} onChange={event => setName(event.target.value)} /></label>
          <label>Unidad base<input required value={baseUnitCode} onChange={event => setBaseUnitCode(event.target.value.toUpperCase())} /></label>
          <label className="checkbox"><input type="checkbox" checked={controlsInventory} onChange={event => setControlsInventory(event.target.checked)} /> Controla inventario</label>
          <label className="wide">Descripción<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
        </div>
        <h3>Presentaciones</h3>
        <div className="presentation-editor">
          {presentations.map((item, index) => (
            <div className="presentation-row" key={index}>
              <label>Código<input required value={item.code} onChange={event => updatePresentation(index, 'code', event.target.value)} /></label>
              <label>Nombre<input required value={item.name} onChange={event => updatePresentation(index, 'name', event.target.value)} /></label>
              <label>Unidad<input required value={item.unitCode} onChange={event => updatePresentation(index, 'unitCode', event.target.value.toUpperCase())} /></label>
              <label>Factor<input required type="number" min="0.000001" step="0.000001" value={item.conversionFactor} onChange={event => updatePresentation(index, 'conversionFactor', Number(event.target.value))} /></label>
              {presentations.length > 1 && <button type="button" className="secondary" onClick={() => setPresentations(current => current.filter((_, position) => position !== index))}>Quitar</button>}
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => setPresentations(current => [...current, emptyPresentation()])}>Agregar presentación</button>
          <button type="submit" className="primary" disabled={createProduct.isPending}>Guardar producto</button>
        </div>
        {createProduct.error && <div className="alert error">{createProduct.error.message}</div>}
      </form>

      <section className="catalog-list" aria-label="Productos registrados">
        {products.isLoading && <p>Cargando productos…</p>}
        {products.error && <div className="alert error">{products.error.message}</div>}
        {products.data?.map(product => (
          <article className="panel product-card" key={product.id}>
            <div>
              <span className={`status ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Activo' : 'Inactivo'}</span>
              <h2>{product.name}</h2>
              <p className="muted">{product.code} · Unidad base: {product.baseUnitCode}</p>
              <ul>{product.presentations.map(item => <li key={item.id}>{item.name} · {item.conversionFactor} {product.baseUnitCode}</li>)}</ul>
            </div>
            <button className="secondary" onClick={() => changeStatus.mutate(product)}>{product.active ? 'Desactivar' : 'Activar'}</button>
          </article>
        ))}
        {products.data?.length === 0 && <p className="muted">Aún no hay productos registrados.</p>}
      </section>
    </main>
  );
}
