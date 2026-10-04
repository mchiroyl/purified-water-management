import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CustomerCombobox, type CustomerOption } from './CustomerCombobox';

const mockCustomers: CustomerOption[] = [
  {
    id: 'c1',
    code: 'C-001',
    name: 'Tienda La Esperanza',
    addressReference: 'Frente a la iglesia católica, portón blanco',
    contactName: 'Don Carlos',
    phone: '5555-1111'
  },
  {
    id: 'c2',
    code: 'C-002',
    name: 'Abarrotería El Progreso',
    addressReference: 'A la par del campo de fútbol, casa azul',
    contactName: 'Doña Marta',
    phone: '5555-2222'
  },
  {
    id: 'c3',
    code: 'C-003',
    name: 'Comedor Los Amigos',
    addressReference: 'Esquina de la farmacia central',
    contactName: 'Juan Pérez',
    phone: '5555-3333'
  }
];

describe('CustomerCombobox', () => {
  it('permite buscar y filtrar por referencia de dirección', () => {
    const onSelect = vi.fn();
    render(
      <CustomerCombobox
        customers={mockCustomers}
        selectedId=""
        onSelect={onSelect}
      />
    );

    const input = screen.getByLabelText(/buscar cliente/i);
    fireEvent.focus(input);
    // Buscar por "iglesia" (referencia de dirección del cliente C-001)
    fireEvent.change(input, { target: { value: 'iglesia' } });

    expect(screen.getByText('Tienda La Esperanza')).toBeInTheDocument();
    expect(screen.getByText(/Frente a la iglesia católica/i)).toBeInTheDocument();
    expect(screen.queryByText('Abarrotería El Progreso')).not.toBeInTheDocument();

    // Seleccionar la coincidencia
    fireEvent.click(screen.getByText('Tienda La Esperanza'));
    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('permite buscar por nombre de contacto y código', () => {
    const onSelect = vi.fn();
    render(
      <CustomerCombobox
        customers={mockCustomers}
        selectedId=""
        onSelect={onSelect}
      />
    );

    const input = screen.getByLabelText(/buscar cliente/i);
    // Buscar por contacto "Doña Marta"
    fireEvent.change(input, { target: { value: 'marta' } });
    expect(screen.getByText('Abarrotería El Progreso')).toBeInTheDocument();
    expect(screen.getByText(/Doña Marta/i)).toBeInTheDocument();

    // Buscar por código "C-003"
    fireEvent.change(input, { target: { value: 'c-003' } });
    expect(screen.getByText('Comedor Los Amigos')).toBeInTheDocument();
  });

  it('muestra la tarjeta de verificación cuando un cliente está seleccionado y permite cambiarlo', () => {
    const onSelect = vi.fn();
    render(
      <CustomerCombobox
        customers={mockCustomers}
        selectedId="c1"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Tienda La Esperanza')).toBeInTheDocument();
    expect(screen.getByText(/Frente a la iglesia católica/i)).toBeInTheDocument();
    expect(screen.getByText(/Don Carlos/i)).toBeInTheDocument();

    // Botón para cambiar cliente
    const changeBtn = screen.getByRole('button', { name: /cambiar/i });
    fireEvent.click(changeBtn);
    expect(onSelect).toHaveBeenCalledWith('');
  });
});
