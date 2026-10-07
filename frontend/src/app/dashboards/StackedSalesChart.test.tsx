import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StackedSalesChart, ChartSale } from './StackedSalesChart';

const mockSales: ChartSale[] = [
  {
    id: 's-1',
    documentNumber: 'FAC-001',
    routeId: 'r-1',
    routeCode: 'RUT-01',
    routeName: 'Ruta San José',
    sellerName: 'Carlos Gómez',
    total: 2400,
    createdAt: '2026-10-04T10:00:00Z',
  },
  {
    id: 's-2',
    documentNumber: 'FAC-002',
    routeId: 'r-2',
    routeCode: 'RUT-02',
    routeName: 'Ruta Central',
    sellerName: 'Juan Pérez',
    total: 1450,
    createdAt: '2026-10-04T12:00:00Z',
  },
  {
    id: 's-3',
    documentNumber: 'FAC-003',
    routeId: 'r-1',
    routeCode: 'RUT-01',
    routeName: 'Ruta San José',
    sellerName: 'Carlos Gómez',
    total: 1200,
    createdAt: '2026-10-05T14:00:00Z',
  },
];

describe('StackedSalesChart', () => {
  it('renderiza mensaje adecuado cuando no hay ventas', () => {
    render(<StackedSalesChart sales={[]} />);
    expect(screen.getByText(/No hay ventas registradas suficientes/i)).toBeInTheDocument();
  });

  it('renderiza título, filtros y tarjetas de picos con ventas existentes', () => {
    render(<StackedSalesChart sales={mockSales} />);

    // Título y filtros
    expect(screen.getByText('Tendencias Históricas y Récords de Ventas')).toBeInTheDocument();
    expect(screen.getByText('Días')).toBeInTheDocument();
    expect(screen.getByText('Semanas')).toBeInTheDocument();
    expect(screen.getByText('Meses')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Por Rutas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Por Vendedor/i })).toBeInTheDocument();

    // Récords (el día con más venta fue el 04 de Octubre con 2400 + 1450 = 3850)
    expect(screen.getByText(/período récord/i)).toBeInTheDocument();
    expect(screen.getByText('Q3,850.00')).toBeInTheDocument();

    // Ruta líder es Ruta San José (2400 + 1200 = 3600)
    expect(screen.getAllByText('Ruta San José').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Q3,600.00/).length).toBeGreaterThan(0);
  });

  it('permite alternar dimensión a Por Vendedor', () => {
    render(<StackedSalesChart sales={mockSales} />);

    const sellerBtn = screen.getByRole('button', { name: /Por Vendedor/i });
    fireEvent.click(sellerBtn);

    // Debe mostrar la etiqueta de Vendedor Top
    expect(screen.getByText(/vendedor top/i)).toBeInTheDocument();
    // Vendedor líder es Carlos Gómez
    expect(screen.getAllByText('Carlos Gómez').length).toBeGreaterThan(0);
  });

  it('permite alternar escalas de tiempo (Semanas y Meses)', () => {
    render(<StackedSalesChart sales={mockSales} />);

    const semanasBtn = screen.getByText('Semanas');
    fireEvent.click(semanasBtn);
    expect(screen.getByText(/Promedio por Semana/i)).toBeInTheDocument();

    const mesesBtn = screen.getByText('Meses');
    fireEvent.click(mesesBtn);
    expect(screen.getByText(/Promedio por Mes/i)).toBeInTheDocument();
  });
});
