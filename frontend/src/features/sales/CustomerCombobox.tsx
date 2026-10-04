import { useState, useEffect, useRef, useMemo, type KeyboardEvent } from 'react';

export type CustomerOption = {
  id: string;
  code: string;
  name: string;
  status?: string;
  routeId?: string;
  customerType?: string;
  addressReference?: string;
  contactName?: string;
  phone?: string;
  whatsapp?: string;
};

interface CustomerComboboxProps {
  customers: CustomerOption[];
  selectedId: string;
  onSelect: (customerId: string) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function CustomerCombobox({
  customers,
  selectedId,
  onSelect,
  disabled = false,
  required = false,
  id = 'sale-customer-select',
  label = 'Cliente',
  placeholder = 'Buscar por nombre, dirección/referencia o código...'
}: CustomerComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedId),
    [customers, selectedId]
  );

  // Filtrado multi-criterio: Nombre, Dirección de referencia, Contacto, Código y Teléfono
  const filteredCustomers = useMemo(() => {
    if (!query.trim()) return customers;
    const q = normalize(query);
    return customers.filter(c => {
      const matchName = normalize(c.name || '').includes(q);
      const matchRef = normalize(c.addressReference || '').includes(q);
      const matchContact = normalize(c.contactName || '').includes(q);
      const matchCode = normalize(c.code || '').includes(q);
      const matchPhone = (c.phone || '').includes(q) || (c.whatsapp || '').includes(q);
      return matchName || matchRef || matchContact || matchCode || matchPhone;
    });
  }, [customers, query]);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Mantener el índice de resaltado dentro de rango
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  const handleSelect = (customerId: string) => {
    onSelect(customerId);
    setIsOpen(false);
    setQuery('');
  };

  const handleClearSelection = () => {
    onSelect('');
    setQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => Math.min(prev + 1, filteredCustomers.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen && filteredCustomers.length > 0 && filteredCustomers[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredCustomers[highlightedIndex].id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Límite de resultados visibles para máxima fluidez en dispositivos móviles
  const visibleLimit = 35;
  const displayedCustomers = filteredCustomers.slice(0, visibleLimit);

  return (
    <div className="searchable-customer-field" ref={containerRef} style={{ position: 'relative' }}>
      <label htmlFor={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}</span>
        {customers.length > 0 && !selectedCustomer && (
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>
            {customers.length} {customers.length === 1 ? 'cliente disponible' : 'clientes en ruta'}
          </span>
        )}
      </label>

      {/* Select HTML oculto pero accesible para tests automatizados y soporte de formularios nativos */}
      <select
        id={id}
        aria-label={label}
        required={required}
        disabled={disabled}
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          border: 0,
          clip: 'rect(0, 0, 0, 0)',
          overflow: 'hidden'
        }}
      >
        <option value="">Seleccionar</option>
        {customers.map(c => (
          <option key={c.id} value={c.id}>
            {c.customerType === 'OCCASIONAL' ? '⚡ ' : ''}{c.code} · {c.name} {c.customerType === 'OCCASIONAL' ? '(Provisional)' : ''}
          </option>
        ))}
      </select>

      {selectedCustomer ? (
        /* Tarjeta visual de verificación del cliente seleccionado (Segura y Ética) */
        <div className="customer-selected-card">
          <div className="customer-selected-info">
            <div className="customer-selected-name">
              <span className="customer-match-badge" style={{ margin: 0, background: '#dcfce7', color: '#166534' }}>
                {selectedCustomer.code}
              </span>
              <span>{selectedCustomer.name}</span>
              {selectedCustomer.customerType === 'OCCASIONAL' && (
                <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>⚡ Provisional</span>
              )}
            </div>
            {selectedCustomer.addressReference && (
              <div className="customer-selected-reference" title="Referencia de dirección">
                <span aria-hidden="true">📍</span>
                <strong>Ref:</strong> {selectedCustomer.addressReference}
              </div>
            )}
            {(selectedCustomer.contactName || selectedCustomer.phone) && (
              <div className="customer-selected-contact">
                {selectedCustomer.contactName && <span>👤 Contacto: {selectedCustomer.contactName}</span>}
                {selectedCustomer.phone && <span> · 📞 {selectedCustomer.phone}</span>}
              </div>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              className="secondary"
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.65rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              onClick={handleClearSelection}
              title="Seleccionar un cliente distinto"
            >
              <span>🔄</span> Cambiar
            </button>
          )}
        </div>
      ) : (
        /* Input de búsqueda interactiva y predictiva */
        <div className="searchable-customer-input-wrap">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Buscar cliente"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            placeholder={disabled ? 'Seleccione primero una ruta…' : placeholder}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            style={{
              borderColor: isOpen ? 'var(--primary)' : undefined,
              backgroundColor: disabled ? '#f8fafc' : '#ffffff'
            }}
          />
          {query && !disabled && (
            <button
              type="button"
              className="clear-btn"
              title="Borrar texto"
              aria-label="Borrar texto de búsqueda"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Menú flotante de resultados predictivos */}
      {isOpen && !disabled && !selectedCustomer && (
        <div className="customer-matches-dropdown" role="listbox" style={{ maxHeight: '280px' }}>
          <div className="customer-matches-header">
            <span>
              {query ? `Resultados para "${query}"` : 'Clientes de la ruta'}
            </span>
            <span>
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="customer-match-empty">
              <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>🔍</div>
              <div>No se encontró ningún cliente con <strong>&quot;{query}&quot;</strong></div>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                Prueba buscando por nombre, calle, tienda o referencia de dirección.
              </p>
            </div>
          ) : (
            displayedCustomers.map((customer, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  className={`customer-match-item-rich ${isHighlighted ? 'selected' : ''}`}
                  onClick={() => handleSelect(customer.id)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="customer-match-title-row">
                    <div className="customer-match-code-name">
                      <span className="customer-match-badge">{customer.code}</span>
                      <span>{customer.name}</span>
                    </div>
                    {customer.customerType === 'OCCASIONAL' && (
                      <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>⚡ Prov.</span>
                    )}
                  </div>

                  {/* Referencia de dirección destacada para el vendedor */}
                  {customer.addressReference ? (
                    <div className="customer-match-ref-row">
                      <span aria-hidden="true">📍</span>
                      <span>{customer.addressReference}</span>
                    </div>
                  ) : (
                    <div className="customer-match-ref-row" style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                      Sin referencia de dirección registrada
                    </div>
                  )}

                  {/* Contacto o teléfono secundario si existe */}
                  {(customer.contactName || customer.phone) && (
                    <div className="customer-match-contact-row">
                      {customer.contactName && <span>👤 {customer.contactName}</span>}
                      {customer.phone && <span> · 📞 {customer.phone}</span>}
                    </div>
                  )}
                </button>
              );
            })
          )}

          {filteredCustomers.length > visibleLimit && (
            <div style={{ textAlign: 'center', padding: '0.4rem', fontSize: '0.78rem', color: 'var(--muted)', borderTop: '1px solid #eef4f5' }}>
              Mostrando los primeros {visibleLimit} de {filteredCustomers.length} clientes. Escribe más letras para afinar la búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
