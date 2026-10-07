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

describe('StackedSalesChart - Línea del Tiempo', () => {
  it('renderiza mensaje adecuado cuando no hay ventas', () => {
    render(<StackedSalesChart sales={[]} />);
    expect(screen.getByText(/No hay ventas registradas suficientes/i)).toBeInTheDocument();
  });

  it('renderiza por defecto la línea del tiempo con tarjetas secuenciales de hitos', () => {
    render(<StackedSalesChart sales={mockSales} />);

    // Título y selector de vista
    expect(screen.getByText('Línea del Tiempo de Ventas y Récords')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Línea del Tiempo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gráfica de Área/i })).toBeInTheDocument();

    // Controles de navegación de la cinta cronológica
    expect(screen.getByRole('button', { name: /Anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();

    // Récords del período superior
    expect(screen.getByText(/período récord/i)).toBeInTheDocument();
    expect(screen.getAllByText('Q3,850.00').length).toBeGreaterThan(0);

    // En las tarjetas secuenciales se identifican las rutas y los vendedores destacados
    expect(screen.getAllByText('Ruta San José').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carlos Gómez').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DÍA PICO/i).length).toBeGreaterThan(0);
  });

  it('permite alternar entre Línea del Tiempo y Gráfica de Área', () => {
    render(<StackedSalesChart sales={mockSales} />);

    const chartBtn = screen.getByRole('button', { name: /Gráfica de Área/i });
    fireEvent.click(chartBtn);

    // En vista gráfica se renderiza el subtítulo y el SVG
    expect(screen.getByText(/Gráfica de líneas y áreas apiladas/i)).toBeInTheDocument();

    // Regresar a Línea del Tiempo
    const timelineBtn = screen.getByRole('button', { name: /Línea del Tiempo/i });
    fireEvent.click(timelineBtn);
    expect(screen.getByText(/Cinta cronológica secuencial/i)).toBeInTheDocument();
  });

  it('permite alternar dimensión y escala temporal', () => {
    render(<StackedSalesChart sales={mockSales} />);

    // Cambiar a Semanas
    const semanasBtn = screen.getByText('Semanas');
    fireEvent.click(semanasBtn);
    expect(screen.getByText(/Promedio por Semana/i)).toBeInTheDocument();

    // Cambiar dimensión a Por Vendedor
    const sellerBtn = screen.getByRole('button', { name: /Por Vendedor/i });
    fireEvent.click(sellerBtn);
    expect(screen.getByText(/vendedor top/i)).toBeInTheDocument();
  });
});
