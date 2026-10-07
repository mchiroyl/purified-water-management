import { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Award,
  Truck,
  User,
  Calendar,
  BarChart3,
  Layers,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export type ChartSaleItem = {
  id: string;
  productName: string;
  presentationQuantity: number;
  quantityBaseUnits: number;
  unitPrice: number;
  lineTotal: number;
};

export type ChartSale = {
  id: string;
  documentNumber: string;
  routeId?: string;
  routeCode?: string;
  routeName?: string;
  sellerName: string;
  customerName?: string;
  total: number;
  createdAt: string;
  items?: ChartSaleItem[];
};

interface StackedSalesChartProps {
  sales: ChartSale[];
  currencyCode?: string;
}

type TimeScale = 'days' | 'weeks' | 'months';
type Dimension = 'route' | 'seller';
type ViewMode = 'timeline' | 'chart';

// Paleta distinguible y moderna
const PALETTE = [
  { stroke: '#0284c7', fill: '#0284c7', bg: 'rgba(2, 132, 199, 0.28)' }, // Sky
  { stroke: '#059669', fill: '#059669', bg: 'rgba(5, 150, 105, 0.28)' }, // Emerald
  { stroke: '#d97706', fill: '#d97706', bg: 'rgba(217, 119, 6, 0.28)' }, // Amber
  { stroke: '#6366f1', fill: '#6366f1', bg: 'rgba(99, 102, 241, 0.28)' }, // Indigo
  { stroke: '#db2777', fill: '#db2777', bg: 'rgba(219, 39, 119, 0.28)' }, // Pink
  { stroke: '#0891b2', fill: '#0891b2', bg: 'rgba(8, 145, 178, 0.28)' }, // Cyan
  { stroke: '#8b5cf6', fill: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.28)' }, // Violet
  { stroke: '#ea580c', fill: '#ea580c', bg: 'rgba(234, 88, 12, 0.28)' }, // Orange
];

function formatMoney(value: number, currency = 'GTQ'): string {
  const sym = currency === 'GTQ' ? 'Q' : `${currency} `;
  return `${sym}${Number(value || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getWeekNumber(d: Date): { year: number; week: number } {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: target.getFullYear(), week };
}

export type BreakdownItem = {
  name: string;
  amount: number;
  pct: number;
};

export type Bucket = {
  key: string;
  label: string;
  fullDateDesc: string;
  rawDate: Date;
  seriesValues: Record<string, number>;
  total: number;
  routes: BreakdownItem[];
  sellers: BreakdownItem[];
  transactionCount: number;
};

export type ProcessedData = {
  buckets: Bucket[];
  seriesList: string[];
  grandTotal: number;
  peakBucket: Bucket | null;
  topSeries: { name: string; total: number; pct: number } | null;
  topRouteOverall: { name: string; total: number } | null;
  topSellerOverall: { name: string; total: number } | null;
};

export function StackedSalesChart({ sales, currencyCode = 'GTQ' }: StackedSalesChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [timeScale, setTimeScale] = useState<TimeScale>('days');
  const [dimension, setDimension] = useState<Dimension>('route');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  const [activeSeriesFilter, setActiveSeriesFilter] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // 1. Procesamiento de datos y agrupación cronológica
  const processed = useMemo<ProcessedData>(() => {
    if (!sales || sales.length === 0) {
      return {
        buckets: [],
        seriesList: [],
        grandTotal: 0,
        peakBucket: null,
        topSeries: null,
        topSellerOverall: null,
        topRouteOverall: null,
      };
    }

    const seriesTotals: Record<string, number> = {};
    const routeTotals: Record<string, number> = {};
    const sellerTotals: Record<string, number> = {};

    sales.forEach((s) => {
      const amt = Number(s.total || 0);
      const rName = s.routeName?.trim() || s.routeCode?.trim() || 'Sin Ruta';
      const sName = s.sellerName?.trim() || 'Vendedor';

      routeTotals[rName] = (routeTotals[rName] || 0) + amt;
      sellerTotals[sName] = (sellerTotals[sName] || 0) + amt;

      const dimKey = dimension === 'route' ? rName : sName;
      seriesTotals[dimKey] = (seriesTotals[dimKey] || 0) + amt;
    });

    const sortedSeries = Object.keys(seriesTotals).sort(
      (a, b) => seriesTotals[b] - seriesTotals[a]
    );

    // Mapeo temporal
    type RawBucket = {
      key: string;
      label: string;
      fullDateDesc: string;
      rawDate: Date;
      seriesValues: Record<string, number>;
      routeMap: Record<string, number>;
      sellerMap: Record<string, number>;
      total: number;
      txCount: number;
    };

    const bucketMap = new Map<string, RawBucket>();

    sales.forEach((s) => {
      if (!s.createdAt) return;
      const d = new Date(s.createdAt);
      if (isNaN(d.getTime())) return;

      let key = '';
      let label = '';
      let fullDateDesc = '';

      if (timeScale === 'days') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        label = d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
        fullDateDesc = d.toLocaleDateString('es-GT', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
      } else if (timeScale === 'weeks') {
        const { year, week } = getWeekNumber(d);
        key = `${year}-W${String(week).padStart(2, '0')}`;
        label = `Sem ${week}`;
        fullDateDesc = `Semana ${week} de ${year}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('es-GT', { month: 'short', year: '2-digit' });
        fullDateDesc = d.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
      }

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          key,
          label,
          fullDateDesc,
          rawDate: d,
          seriesValues: {},
          routeMap: {},
          sellerMap: {},
          total: 0,
          txCount: 0,
        });
      }

      const b = bucketMap.get(key)!;
      const amt = Number(s.total || 0);
      const rName = s.routeName?.trim() || s.routeCode?.trim() || 'Sin Ruta';
      const sName = s.sellerName?.trim() || 'Vendedor';
      const dimKey = dimension === 'route' ? rName : sName;

      b.seriesValues[dimKey] = (b.seriesValues[dimKey] || 0) + amt;
      b.routeMap[rName] = (b.routeMap[rName] || 0) + amt;
      b.sellerMap[sName] = (b.sellerMap[sName] || 0) + amt;
      b.total += amt;
      b.txCount += 1;
    });

    const sortedRaw = Array.from(bucketMap.values()).sort(
      (a, b) => a.key.localeCompare(b.key)
    );

    // Limitar para mantener fluidez
    const displayRaw = timeScale === 'days'
      ? sortedRaw.slice(-21)
      : timeScale === 'weeks'
      ? sortedRaw.slice(-14)
      : sortedRaw.slice(-12);

    const formattedBuckets: Bucket[] = displayRaw.map((rb) => {
      const routes: BreakdownItem[] = Object.entries(rb.routeMap)
        .map(([name, amount]) => ({
          name,
          amount,
          pct: rb.total > 0 ? (amount / rb.total) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const sellers: BreakdownItem[] = Object.entries(rb.sellerMap)
        .map(([name, amount]) => ({
          name,
          amount,
          pct: rb.total > 0 ? (amount / rb.total) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        key: rb.key,
        label: rb.label,
        fullDateDesc: rb.fullDateDesc,
        rawDate: rb.rawDate,
        seriesValues: rb.seriesValues,
        total: rb.total,
        routes,
        sellers,
        transactionCount: rb.txCount,
      };
    });

    const grandTotal = formattedBuckets.reduce((acc, b) => acc + b.total, 0);

    let peakBucket: Bucket | null = null;
    formattedBuckets.forEach((b) => {
      if (!peakBucket || b.total > peakBucket.total) {
        peakBucket = b;
      }
    });

    const topSeriesName = sortedSeries[0] || 'N/A';
    const topSeriesTotal = seriesTotals[topSeriesName] || 0;

    const topRoute = Object.entries(routeTotals).sort((a, b) => b[1] - a[1])[0];
    const topSeller = Object.entries(sellerTotals).sort((a, b) => b[1] - a[1])[0];

    return {
      buckets: formattedBuckets,
      seriesList: sortedSeries,
      grandTotal,
      peakBucket,
      topSeries: {
        name: topSeriesName,
        total: topSeriesTotal,
        pct: grandTotal > 0 ? (topSeriesTotal / grandTotal) * 100 : 0,
      },
      topRouteOverall: topRoute ? { name: topRoute[0], total: topRoute[1] } : null,
      topSellerOverall: topSeller ? { name: topSeller[0], total: topSeller[1] } : null,
    };
  }, [sales, timeScale, dimension]);

  const { buckets, seriesList, peakBucket, topSeries, grandTotal, topSellerOverall, topRouteOverall } = processed;

  // Scroll horizontal en la línea de tiempo
  const scrollTimeline = (direction: 'left' | 'right') => {
    if (!timelineScrollRef.current) return;
    const scrollAmount = direction === 'left' ? -380 : 380;
    timelineScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // Coordenadas para la vista de gráfica (SVG)
  const width = 860;
  const height = 300;
  const paddingLeft = 65;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const chartData = useMemo(() => {
    if (buckets.length === 0) return null;
    const maxVal = Math.max(...buckets.map((b) => b.total), 10);
    const yMax = Math.ceil(maxVal * 1.15 / 500) * 500 || 500;

    const activeSeries = activeSeriesFilter
      ? seriesList.filter((s) => s === activeSeriesFilter)
      : seriesList;

    const xStep = buckets.length > 1 ? chartWidth / (buckets.length - 1) : chartWidth / 2;
    const xCoords = buckets.map((_, i) =>
      buckets.length > 1 ? paddingLeft + i * xStep : paddingLeft + chartWidth / 2
    );

    const stackedLayers: {
      seriesName: string;
      color: typeof PALETTE[0];
      pathD: string;
      lineD: string;
      points: { x: number; yTop: number; yBottom: number; value: number }[];
    }[] = [];

    const currentBaseY = new Array(buckets.length).fill(0);

    activeSeries.forEach((seriesName, seriesIdx) => {
      const color = PALETTE[seriesIdx % PALETTE.length];
      const points: { x: number; yTop: number; yBottom: number; value: number }[] = [];

      buckets.forEach((b, i) => {
        const val = Number(b.seriesValues[seriesName] || 0);
        const y0Val = currentBaseY[i];
        const y1Val = y0Val + val;
        currentBaseY[i] = y1Val;

        const x = xCoords[i];
        const yTop = paddingTop + chartHeight - (y1Val / yMax) * chartHeight;
        const yBottom = paddingTop + chartHeight - (y0Val / yMax) * chartHeight;

        points.push({ x, yTop, yBottom, value: val });
      });

      let topCurve = `M ${points[0].x},${points[0].yTop}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cx = (p0.x + p1.x) / 2;
        topCurve += ` C ${cx},${p0.yTop} ${cx},${p1.yTop} ${p1.x},${p1.yTop}`;
      }

      let bottomCurve = `L ${points[points.length - 1].x},${points[points.length - 1].yBottom}`;
      for (let i = points.length - 1; i > 0; i--) {
        const p0 = points[i];
        const p1 = points[i - 1];
        const cx = (p0.x + p1.x) / 2;
        bottomCurve += ` C ${cx},${p0.yBottom} ${cx},${p1.yBottom} ${p1.x},${p1.yBottom}`;
      }
      bottomCurve += ' Z';

      stackedLayers.push({
        seriesName,
        color,
        pathD: `${topCurve} ${bottomCurve}`,
        lineD: topCurve,
        points,
      });
    });

    const yGridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
      const val = yMax * pct;
      const yPos = paddingTop + chartHeight - pct * chartHeight;
      return { val, yPos };
    });

    return { xCoords, yMax, stackedLayers, yGridLines };
  }, [buckets, seriesList, activeSeriesFilter, chartWidth, chartHeight, paddingLeft, paddingTop]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chartData || buckets.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = width / rect.width;
    const svgX = clientX * scaleX;

    let closestIdx = 0;
    let minDist = Infinity;
    chartData.xCoords.forEach((x, idx) => {
      const dist = Math.abs(x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  if (!sales || sales.length === 0) {
    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        padding: '2rem 1.5rem',
        textAlign: 'center',
        marginBottom: '1.5rem',
        color: '#64748b'
      }}>
        <Clock size={32} strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
        <h3 style={{ margin: '0 0 0.35rem', color: '#0f172a', fontSize: '1rem', fontWeight: 600 }}>
          Línea del Tiempo y Tendencias de Ventas
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>
          No hay ventas registradas suficientes para calcular el historial acumulado en este momento.
        </p>
      </div>
    );
  }

  const activeBucket = hoveredIndex !== null && buckets[hoveredIndex] ? buckets[hoveredIndex] : null;

  return (
    <section
      className="panel section-panel"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        marginBottom: '1.5rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* 1. Header con Título, Selector de Vista (Línea de Tiempo vs Gráfica) y Filtros */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                background: '#0284c7',
                color: '#ffffff',
                padding: '0.35rem',
                borderRadius: '0.45rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={16} strokeWidth={2.5} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Línea del Tiempo de Ventas y Récords
            </h2>
          </div>
          <p style={{ margin: '0.2rem 0 0 2.2rem', color: '#64748b', fontSize: '0.8rem' }}>
            {viewMode === 'timeline'
              ? 'Cinta cronológica secuencial con ventas, picos, rutas y vendedores'
              : 'Gráfica de líneas y áreas apiladas por volumen acumulado'}
          </p>
        </div>

        {/* Barra de Controles: Vista + Tiempo + Dimensión */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Alternar Vista: Línea del Tiempo vs Gráfica */}
          <div
            style={{
              display: 'inline-flex',
              background: '#0f172a',
              padding: '2px',
              borderRadius: '0.5rem',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              style={{
                background: viewMode === 'timeline' ? '#0284c7' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.4rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
            >
              <Clock size={13} strokeWidth={2.5} /> Línea del Tiempo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              style={{
                background: viewMode === 'chart' ? '#0284c7' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.4rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
            >
              <TrendingUp size={13} strokeWidth={2.5} /> Gráfica de Área
            </button>
          </div>

          {/* Selector de Tiempo (Días, Semanas, Meses) */}
          <div
            style={{
              display: 'inline-flex',
              background: '#e2e8f0',
              padding: '2px',
              borderRadius: '0.5rem',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            {(['days', 'weeks', 'months'] as TimeScale[]).map((scale) => {
              const label = scale === 'days' ? 'Días' : scale === 'weeks' ? 'Semanas' : 'Meses';
              const active = timeScale === scale;
              return (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setTimeScale(scale)}
                  style={{
                    background: active ? '#0f172a' : 'transparent',
                    color: active ? '#ffffff' : '#475569',
                    border: 'none',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Selector de Dimensión */}
          <div
            style={{
              display: 'inline-flex',
              background: '#e2e8f0',
              padding: '2px',
              borderRadius: '0.5rem',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setDimension('route');
                setActiveSeriesFilter(null);
              }}
              style={{
                background: dimension === 'route' ? '#0284c7' : 'transparent',
                color: dimension === 'route' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.4rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
            >
              <Truck size={13} strokeWidth={2} /> Por Rutas
            </button>
            <button
              type="button"
              onClick={() => {
                setDimension('seller');
                setActiveSeriesFilter(null);
              }}
              style={{
                background: dimension === 'seller' ? '#0284c7' : 'transparent',
                color: dimension === 'seller' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.4rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
            >
              <User size={13} strokeWidth={2} /> Por Vendedor
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tarjetas de Referencia Analítica (Picos y Récords del Período) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.55rem',
            padding: '0.75rem 0.9rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#64748b',
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            <span>Período Récord</span>
            <Award size={15} color="#d97706" />
          </div>
          <strong
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'block',
              margin: '0.25rem 0 0.15rem',
            }}
          >
            {peakBucket ? formatMoney(peakBucket.total, currencyCode) : 'Q0.00'}
          </strong>
          <div style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 600 }}>
            {peakBucket ? peakBucket.fullDateDesc : 'Sin datos'}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.55rem',
            padding: '0.75rem 0.9rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#64748b',
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            <span>{dimension === 'route' ? 'Ruta con Más Venta' : 'Vendedor Top'}</span>
            {dimension === 'route' ? <Truck size={15} color="#059669" /> : <User size={15} color="#059669" />}
          </div>
          <strong
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'block',
              margin: '0.25rem 0 0.15rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {topSeries ? topSeries.name : 'N/A'}
          </strong>
          <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>
            {topSeries ? `${formatMoney(topSeries.total, currencyCode)} (${topSeries.pct.toFixed(1)}%)` : ''}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.55rem',
            padding: '0.75rem 0.9rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#64748b',
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            <span>{dimension === 'route' ? 'Vendedor Destacado' : 'Ruta Destacada'}</span>
            {dimension === 'route' ? <User size={15} color="#6366f1" /> : <Truck size={15} color="#6366f1" />}
          </div>
          <strong
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'block',
              margin: '0.25rem 0 0.15rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {dimension === 'route'
              ? (topSellerOverall ? topSellerOverall.name : 'N/A')
              : (topRouteOverall ? topRouteOverall.name : 'N/A')}
          </strong>
          <div style={{ fontSize: '0.74rem', color: '#6366f1', fontWeight: 600 }}>
            {dimension === 'route'
              ? (topSellerOverall ? formatMoney(topSellerOverall.total, currencyCode) : '')
              : (topRouteOverall ? formatMoney(topRouteOverall.total, currencyCode) : '')}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.55rem',
            padding: '0.75rem 0.9rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#64748b',
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            <span>Promedio por {timeScale === 'days' ? 'Día' : timeScale === 'weeks' ? 'Semana' : 'Mes'}</span>
            <Calendar size={15} color="#0891b2" />
          </div>
          <strong
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'block',
              margin: '0.25rem 0 0.15rem',
            }}
          >
            {buckets.length > 0 ? formatMoney(grandTotal / buckets.length, currencyCode) : 'Q0.00'}
          </strong>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Total acumulado: <strong>{formatMoney(grandTotal, currencyCode)}</strong>
          </div>
        </div>
      </div>

      {/* 3. VISTA A: CINTA DE LÍNEA DEL TIEMPO SECUENCIAL (TIMELINE FEED) */}
      {viewMode === 'timeline' && (
        <div style={{ padding: '1.25rem' }}>
          {/* Controles de navegación y leyenda rápida de la línea de tiempo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.82rem' }}>
              <Sparkles size={14} color="#d97706" />
              <span>Desplázate cronológicamente para revisar cada hito: qué día/semana se vendió más, en qué ruta y por qué vendedor.</span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => scrollTimeline('left')}
                className="secondary"
                style={{ padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                title="Desplazar a fechas anteriores"
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button
                type="button"
                onClick={() => scrollTimeline('right')}
                className="secondary"
                style={{ padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                title="Desplazar a fechas siguientes"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Riel Cronológico Horizontal Deslizable con Línea Central Conectora */}
          <div style={{ position: 'relative' }}>
            {/* Línea horizontal central del Timeline (Spine) */}
            <div
              style={{
                position: 'absolute',
                top: '26px',
                left: '20px',
                right: '20px',
                height: '3px',
                background: 'linear-gradient(90deg, #cbd5e1 0%, #0284c7 50%, #cbd5e1 100%)',
                zIndex: 1,
              }}
            />

            <div
              ref={timelineScrollRef}
              style={{
                display: 'flex',
                gap: '1.15rem',
                overflowX: 'auto',
                padding: '0.5rem 0.25rem 1.25rem',
                position: 'relative',
                zIndex: 2,
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'thin',
              }}
            >
              {buckets.map((b, idx) => {
                const isPeak = peakBucket?.key === b.key;
                const isSelected = selectedBucketKey === b.key;
                const peakMax = peakBucket?.total || 1;
                const pctOfPeak = Math.min(100, Math.round((b.total / peakMax) * 100));

                const topRouteOfDay = b.routes[0];
                const topSellerOfDay = b.sellers[0];

                return (
                  <div
                    key={b.key}
                    onClick={() => setSelectedBucketKey(isSelected ? null : b.key)}
                    style={{
                      flex: '0 0 290px',
                      scrollSnapAlign: 'start',
                      background: isPeak ? '#f0fdf4' : isSelected ? '#f8fafc' : '#ffffff',
                      border: isPeak
                        ? '2px solid #22c55e'
                        : isSelected
                        ? '2px solid #0284c7'
                        : '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      boxShadow: isPeak
                        ? '0 6px 16px rgba(34, 197, 94, 0.15)'
                        : '0 2px 5px rgba(0,0,0,0.03)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Nodo de la Línea de Tiempo (Círculo con fecha) */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.65rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isPeak ? '#16a34a' : '#0f172a',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                          }}
                        >
                          {idx + 1}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          {b.label}
                        </span>
                      </div>

                      {/* Insignia de Récord o Pico */}
                      {isPeak && (
                        <span
                          style={{
                            background: '#16a34a',
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Award size={11} /> DÍA PICO
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      {b.fullDateDesc}
                    </div>

                    {/* Monto de Ventas en Grande */}
                    <div style={{ marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Vendido en el hito:
                      </span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: isPeak ? '#15803d' : '#0f172a' }}>
                        {formatMoney(b.total, currencyCode)}
                      </div>
                    </div>

                    {/* Barra de progreso relativo respecto al pico */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                        <span>Volumen vs Récord</span>
                        <strong>{pctOfPeak}%</strong>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pctOfPeak}%`,
                            height: '100%',
                            background: isPeak ? '#22c55e' : '#0284c7',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                    </div>

                    {/* Desglose: Ruta que más vendió */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        borderRadius: '0.5rem',
                        padding: '0.55rem 0.65rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0369a1', fontSize: '0.72rem', fontWeight: 700 }}>
                        <Truck size={13} /> RUTA CON MÁS VENTA:
                      </div>
                      {topRouteOfDay ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                            {topRouteOfDay.name}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>
                            {formatMoney(topRouteOfDay.amount, currencyCode)} ({topRouteOfDay.pct.toFixed(0)}%)
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sin ruta asignada</div>
                      )}
                    </div>

                    {/* Desglose: Vendedor que más vendió */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        borderRadius: '0.5rem',
                        padding: '0.55rem 0.65rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#047857', fontSize: '0.72rem', fontWeight: 700 }}>
                        <User size={13} /> VENDEDOR MÁS PRODUCTIVO:
                      </div>
                      {topSellerOfDay ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                            {topSellerOfDay.name}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857' }}>
                            {formatMoney(topSellerOfDay.amount, currencyCode)} ({topSellerOfDay.pct.toFixed(0)}%)
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sin vendedor</div>
                      )}
                    </div>

                    {/* Operaciones */}
                    <div style={{ marginTop: 'auto', paddingTop: '0.4rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                      <span>{b.transactionCount} {b.transactionCount === 1 ? 'venta realizada' : 'ventas realizadas'}</span>
                      <span style={{ color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                        Ver detalle <ArrowRight size={10} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. VISTA B: GRÁFICA DE LÍNEAS Y ÁREAS APILADAS (CURVA VECTORIAL SVG) */}
      {viewMode === 'chart' && (
        <div style={{ padding: '1.25rem', position: 'relative' }}>
          <div style={{ width: '100%', position: 'relative' }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                overflow: 'visible',
                cursor: 'crosshair',
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                {chartData?.stackedLayers.map((layer) => (
                  <linearGradient
                    key={layer.seriesName}
                    id={`grad-${layer.seriesName.replace(/[^a-zA-Z0-9]/g, '_')}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={layer.color.fill} stopOpacity="0.65" />
                    <stop offset="100%" stopColor={layer.color.fill} stopOpacity="0.08" />
                  </linearGradient>
                ))}
              </defs>

              {chartData?.yGridLines.map((grid, i) => (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={grid.yPos}
                    x2={width - paddingRight}
                    y2={grid.yPos}
                    stroke={i === 0 ? '#cbd5e1' : '#f1f5f9'}
                    strokeWidth={i === 0 ? 1.5 : 1}
                    strokeDasharray={i === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={paddingLeft - 10}
                    y={grid.yPos + 4}
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="end"
                    fontFamily="system-ui, sans-serif"
                  >
                    {grid.val >= 1000
                      ? `Q${(grid.val / 1000).toFixed(grid.val % 1000 === 0 ? 0 : 1)}k`
                      : `Q${Math.round(grid.val)}`}
                  </text>
                </g>
              ))}

              {chartData?.stackedLayers.map((layer) => {
                const gradId = `grad-${layer.seriesName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                return (
                  <g key={layer.seriesName}>
                    <path d={layer.pathD} fill={`url(#${gradId})`} />
                    <path
                      d={layer.lineD}
                      fill="none"
                      stroke={layer.color.stroke}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}

              {buckets.map((b, i) => {
                const x = chartData?.xCoords[i] || 0;
                const isHovered = hoveredIndex === i;
                const isPeak = peakBucket?.key === b.key;

                return (
                  <g key={b.key}>
                    <line
                      x1={x}
                      y1={paddingTop + chartHeight}
                      x2={x}
                      y2={paddingTop + chartHeight + 5}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={paddingTop + chartHeight + 18}
                      fill={isHovered ? '#0f172a' : isPeak ? '#0284c7' : '#64748b'}
                      fontSize={isHovered || isPeak ? '11' : '10'}
                      fontWeight={isHovered || isPeak ? '700' : '500'}
                      textAnchor="middle"
                      fontFamily="system-ui, sans-serif"
                    >
                      {b.label}
                    </text>
                    {isPeak && (
                      <text
                        x={x}
                        y={paddingTop + chartHeight + 29}
                        fill="#d97706"
                        fontSize="9"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        ★ Pico
                      </text>
                    )}
                  </g>
                );
              })}

              {hoveredIndex !== null && chartData && (
                <g>
                  <line
                    x1={chartData.xCoords[hoveredIndex]}
                    y1={paddingTop}
                    x2={chartData.xCoords[hoveredIndex]}
                    y2={paddingTop + chartHeight}
                    stroke="#475569"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {chartData.stackedLayers.map((layer) => {
                    const pt = layer.points[hoveredIndex];
                    if (!pt || pt.value <= 0) return null;
                    return (
                      <circle
                        key={layer.seriesName}
                        cx={pt.x}
                        cy={pt.yTop}
                        r="4.5"
                        fill={layer.color.stroke}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              )}
            </svg>

            {activeBucket && hoveredIndex !== null && chartData && (
              <div
                style={{
                  position: 'absolute',
                  top: `${paddingTop + 10}px`,
                  left: `${
                    chartData.xCoords[hoveredIndex] > width * 0.6
                      ? Math.max(10, (chartData.xCoords[hoveredIndex] / width) * 100 - 32)
                      : Math.min(68, (chartData.xCoords[hoveredIndex] / width) * 100 + 3)
                  }%`,
                  background: '#0f172a',
                  color: '#ffffff',
                  border: '1px solid #334155',
                  borderRadius: '0.65rem',
                  padding: '0.75rem 0.95rem',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.4)',
                  pointerEvents: 'none',
                  minWidth: '220px',
                  zIndex: 10,
                  fontSize: '0.8rem',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: '#f8fafc',
                    borderBottom: '1px solid #334155',
                    paddingBottom: '0.35rem',
                    marginBottom: '0.45rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{activeBucket.fullDateDesc}</span>
                  {peakBucket?.key === activeBucket.key && (
                    <span
                      style={{
                        background: '#d97706',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      RÉCORD
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    color: '#38bdf8',
                    marginBottom: '0.55rem',
                  }}
                >
                  Total: {formatMoney(activeBucket.total, currencyCode)}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {chartData.stackedLayers.map((layer) => {
                    const val = activeBucket.seriesValues[layer.seriesName] || 0;
                    const pct = activeBucket.total > 0 ? (val / activeBucket.total) * 100 : 0;
                    return (
                      <div
                        key={layer.seriesName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.74rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: layer.color.stroke,
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ color: '#cbd5e1' }}>{layer.seriesName}:</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ color: '#ffffff', marginLeft: '0.4rem' }}>
                            {formatMoney(val, currencyCode)}
                          </strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem', marginLeft: '0.3rem' }}>
                            ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
              marginTop: '0.85rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Layers size={13} /> {dimension === 'route' ? 'Rutas:' : 'Vendedores:'}
            </span>

            {seriesList.map((seriesName, idx) => {
              const color = PALETTE[idx % PALETTE.length];
              const isFiltered = activeSeriesFilter === seriesName;
              const seriesTotal = buckets.reduce(
                (acc, b) => acc + (b.seriesValues[seriesName] || 0),
                0
              );

              return (
                <button
                  key={seriesName}
                  type="button"
                  onClick={() =>
                    setActiveSeriesFilter(activeSeriesFilter === seriesName ? null : seriesName)
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '999px',
                    border: `1px solid ${isFiltered ? color.stroke : '#e2e8f0'}`,
                    background: isFiltered ? color.bg : '#ffffff',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    color: '#1e293b',
                    fontWeight: isFiltered ? 700 : 500,
                    transition: 'all 0.15s ease',
                  }}
                  title={`Haz clic para ${isFiltered ? 'mostrar todas' : `aislar ${seriesName}`}`}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: color.stroke,
                      display: 'inline-block',
                    }}
                  />
                  <span>{seriesName}</span>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                    ({formatMoney(seriesTotal, currencyCode)})
                  </span>
                </button>
              );
            })}

            {activeSeriesFilter && (
              <button
                type="button"
                onClick={() => setActiveSeriesFilter(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#0284c7',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Mostrar todas
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
