import { useState, useMemo } from 'react';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function money(value: number): string {
  return `Q${Number(value || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid #e2e8f0',
        borderRadius: '0.4rem',
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: '0.28rem 0.7rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: value === opt ? '#0f172a' : '#ffffff',
            color: value === opt ? '#ffffff' : '#64748b',
            transition: 'all 0.15s',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  toggle,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  toggle?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.9rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                margin: '0.1rem 0 0',
                fontSize: '0.72rem',
                color: '#64748b',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {toggle}
      </div>
      <div style={{ padding: '1.1rem 1.25rem' }}>{children}</div>
    </section>
  );
}

// ─── 1. RANKING DE VENTAS POR VENDEDOR ───────────────────────────────────────

export type ChartSale = {
  id: string;
  routeCode: string;
  routeName: string;
  sellerName: string;
  total: number;
  createdAt: string;
};

function getWeekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function getMonthStart() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function SalesRankingChart({ sales }: { sales: ChartSale[] }) {
  const [period, setPeriod] = useState<'Semana' | 'Mes'>('Semana');

  const sellers = useMemo(() => {
    const cutoff =
      period === 'Semana' ? getWeekStart() : getMonthStart();
    const filtered = sales.filter(
      (s) => s.createdAt && new Date(s.createdAt) >= cutoff,
    );
    const map = new Map<string, number>();
    for (const s of filtered) {
      const name = s.sellerName?.trim() || 'Sin nombre';
      map.set(name, (map.get(name) ?? 0) + Number(s.total || 0));
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [sales, period]);

  const max = sellers[0]?.total || 1;
  const barHeight = 28;
  const gap = 12;
  const labelWidth = 90;
  const valueWidth = 68;
  const chartW = 320;
  const svgH = sellers.length * (barHeight + gap) + 8;

  const COLORS = [
    '#059669',
    '#10b981',
    '#34d399',
    '#6ee7b7',
    '#a7f3d0',
    '#d1fae5',
  ];

  return (
    <ChartCard
      title="Ranking de Ventas por Vendedor"
      subtitle={`Acumulado de la ${period === 'Semana' ? 'semana actual' : 'mes actual'}`}
      toggle={
        <Toggle
          options={['Semana', 'Mes']}
          value={period}
          onChange={(v) => setPeriod(v as 'Semana' | 'Mes')}
        />
      }
    >
      {sellers.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '1.5rem 0' }}>
          Sin ventas registradas en este período
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${gap}px`,
              minWidth: 320,
            }}
          >
            {sellers.map((s, i) => {
              const pct = max > 0 ? (s.total / max) * 100 : 0;
              const isFirst = i === 0;
              return (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Rank badge */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: isFirst ? '#059669' : '#f1f5f9',
                      color: isFirst ? '#ffffff' : '#94a3b8',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  {/* Name */}
                  <span
                    style={{
                      width: labelWidth,
                      fontSize: '0.78rem',
                      fontWeight: isFirst ? 700 : 500,
                      color: isFirst ? '#0f172a' : '#475569',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flexShrink: 0,
                    }}
                    title={s.name}
                  >
                    {s.name}
                  </span>
                  {/* Bar track */}
                  <div
                    style={{
                      flex: 1,
                      height: barHeight,
                      background: '#f1f5f9',
                      borderRadius: '0.3rem',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${COLORS[Math.min(i, COLORS.length - 1)]}, ${COLORS[Math.min(i + 1, COLORS.length - 1)]})`,
                        borderRadius: '0.3rem',
                        transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                      }}
                    />
                  </div>
                  {/* Value */}
                  <span
                    style={{
                      width: valueWidth,
                      textAlign: 'right',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: isFirst ? '#059669' : '#334155',
                      fontFeatureSettings: '"tnum"',
                      flexShrink: 0,
                    }}
                  >
                    {money(s.total)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ─── 2. CARTERA DE DEUDORES CxC ──────────────────────────────────────────────

export type ChartCredit = {
  date: string;      // ISO date string
  issued: number;    // crédito otorgado ese día
  collected: number; // cobrado ese día
};

function buildCreditData(
  sales: ChartSale[],
  period: 'Semana' | 'Mes',
): ChartCredit[] {
  const now = new Date();
  const entries: ChartCredit[] = [];

  if (period === 'Semana') {
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      entries.push({ date: key, issued: 0, collected: 0 });
    }
  } else {
    // Last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      entries.push({ date: key, issued: 0, collected: 0 });
    }
  }

  // Accumulate sales credit into the nearest bucket
  for (const s of sales) {
    if (!s.createdAt) continue;
    const saleDate = s.createdAt.slice(0, 10);
    // Find the bucket
    let bucketIdx = entries.findIndex((e) => e.date === saleDate);
    if (bucketIdx === -1 && period === 'Mes') {
      // assign to nearest week bucket
      const saleTime = new Date(s.createdAt).getTime();
      let nearest = 0;
      let minDiff = Infinity;
      entries.forEach((e, idx) => {
        const diff = Math.abs(new Date(e.date).getTime() - saleTime);
        if (diff < minDiff) { minDiff = diff; nearest = idx; }
      });
      bucketIdx = nearest;
    }
    if (bucketIdx !== -1) {
      entries[bucketIdx].issued += Number(s.total || 0);
    }
  }

  return entries;
}

export function DebtorChart({
  sales,
  creditTotal,
}: {
  sales: ChartSale[];
  creditTotal: number;
}) {
  const [period, setPeriod] = useState<'Semana' | 'Mes'>('Semana');

  const data = useMemo(
    () => buildCreditData(sales, period),
    [sales, period],
  );

  const maxVal = Math.max(...data.flatMap((d) => [d.issued, d.collected]), 1);

  const barW = 18;
  const groupGap = 10;
  const groupW = barW * 2 + groupGap;
  const paddingX = 48;
  const paddingY = 16;
  const chartH = 160;
  const svgW = data.length * (groupW + 16) + paddingX * 2;

  const yLines = [0, 0.25, 0.5, 0.75, 1];

  const DAY_LABELS: Record<number, string> = {
    0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
  };

  function label(dateStr: string, idx: number): string {
    if (period === 'Semana') {
      const d = new Date(dateStr + 'T12:00:00');
      return DAY_LABELS[d.getDay()] ?? dateStr;
    }
    return `S${idx + 1}`;
  }

  return (
    <ChartCard
      title="Cartera de Deudores (CxC)"
      subtitle="Crédito otorgado vs cobros recibidos"
      toggle={
        <Toggle
          options={['Semana', 'Mes']}
          value={period}
          onChange={(v) => setPeriod(v as 'Semana' | 'Mes')}
        />
      }
    >
      {/* Summary pill */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
        <span style={{ padding: '0.25rem 0.65rem', borderRadius: '0.35rem', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.73rem', fontWeight: 700 }}>
          ● Crédito otorgado: {money(creditTotal)}
        </span>
        <span style={{ padding: '0.25rem 0.65rem', borderRadius: '0.35rem', background: '#fff7ed', color: '#b45309', fontSize: '0.73rem', fontWeight: 700 }}>
          ● Cobranza efectiva: {money(data.reduce((acc, d) => acc + d.collected, 0))}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg
          width={svgW}
          height={chartH + paddingY * 2 + 28}
          style={{ display: 'block', minWidth: 280 }}
        >
          {/* Y grid lines */}
          {yLines.map((frac) => {
            const y = paddingY + chartH - frac * chartH;
            return (
              <g key={frac}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgW - 8}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                />
                <text
                  x={paddingX - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={9}
                  fill="#94a3b8"
                >
                  {frac > 0 ? `Q${Math.round((maxVal * frac) / 1000)}k` : '0'}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const x = paddingX + i * (groupW + 16);
            const issuedH = maxVal > 0 ? (d.issued / maxVal) * chartH : 0;
            const collectedH = maxVal > 0 ? (d.collected / maxVal) * chartH : 0;
            const issuedY = paddingY + chartH - issuedH;
            const collectedY = paddingY + chartH - collectedH;

            return (
              <g key={d.date}>
                {/* Issued bar (blue) */}
                <rect
                  x={x}
                  y={issuedY}
                  width={barW}
                  height={issuedH}
                  rx={3}
                  fill="#0284c7"
                  opacity={0.85}
                />
                {/* Collected bar (orange) */}
                <rect
                  x={x + barW + groupGap}
                  y={collectedY}
                  width={barW}
                  height={collectedH}
                  rx={3}
                  fill="#f59e0b"
                  opacity={0.9}
                />
                {/* X label */}
                <text
                  x={x + groupW / 2}
                  y={paddingY + chartH + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                  fontWeight={500}
                >
                  {label(d.date, i)}
                </text>
              </g>
            );
          })}

          {/* X axis base line */}
          <line
            x1={paddingX}
            y1={paddingY + chartH}
            x2={svgW - 8}
            y2={paddingY + chartH}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0284c7', display: 'inline-block' }} />
          Crédito Otorgado
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />
          Cobranza Efectiva
        </span>
      </div>
    </ChartCard>
  );
}

// ─── 3. GARRAFONES PRESTADOS POR RUTA ────────────────────────────────────────

export type RouteBalance = {
  routeId: string;
  routeCode: string;
  routeName: string;
  sellerName?: string;
  products: { productName: string; qty: number }[];
};

export function LoanedGarrafonsChart({
  routes,
}: {
  routes: RouteBalance[];
}) {
  const [view, setView] = useState<'Ruta' | 'Vendedor'>('Ruta');

  // Aggregate by route or seller
  const rows = useMemo(() => {
    if (view === 'Ruta') {
      return routes
        .map((r) => ({
          label: r.routeName || r.routeCode,
          total: r.products.reduce((acc, p) => acc + p.qty, 0),
          products: r.products,
        }))
        .sort((a, b) => b.total - a.total);
    } else {
      const map = new Map<string, { total: number; products: Map<string, number> }>();
      for (const r of routes) {
        const seller = r.sellerName || r.routeCode;
        const existing = map.get(seller);
        if (!existing) {
          const pm = new Map<string, number>();
          r.products.forEach((p) => pm.set(p.productName, (pm.get(p.productName) ?? 0) + p.qty));
          map.set(seller, { total: r.products.reduce((a, p) => a + p.qty, 0), products: pm });
        } else {
          r.products.forEach((p) => {
            existing.products.set(p.productName, (existing.products.get(p.productName) ?? 0) + p.qty);
            existing.total += p.qty;
          });
        }
      }
      return Array.from(map.entries())
        .map(([label, { total, products }]) => ({
          label,
          total,
          products: Array.from(products.entries()).map(([productName, qty]) => ({ productName, qty })),
        }))
        .sort((a, b) => b.total - a.total);
    }
  }, [routes, view]);

  // Collect all product names for colors
  const allProducts = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.products.forEach((p) => set.add(p.productName)));
    return Array.from(set);
  }, [rows]);

  const PRODUCT_COLORS = [
    '#0891b2', '#06b6d4', '#67e8f9', '#a5f3fc',
    '#0284c7', '#38bdf8',
  ];

  const maxTotal = rows[0]?.total || 1;
  const barHeight = 30;
  const gap = 10;
  const labelWidth = 100;
  const trackWidth = 200;

  return (
    <ChartCard
      title="Garrafones en Circulación (Comodato / Préstamo)"
      subtitle="Unidades fuera de bodega por ruta o vendedor"
      toggle={
        <Toggle
          options={['Ruta', 'Vendedor']}
          value={view}
          onChange={(v) => setView(v as 'Ruta' | 'Vendedor')}
        />
      }
    >
      {rows.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '1.5rem 0' }}>
          Sin inventario en circulación registrado
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
            {rows.map((row, rowIdx) => {
              let cursor = 0;
              return (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {/* Label */}
                  <span
                    style={{
                      width: labelWidth,
                      fontSize: '0.78rem',
                      fontWeight: rowIdx === 0 ? 700 : 500,
                      color: rowIdx === 0 ? '#0f172a' : '#475569',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={row.label}
                  >
                    {row.label}
                  </span>
                  {/* Stacked bar */}
                  <div
                    style={{
                      flex: 1,
                      height: barHeight,
                      background: '#f1f5f9',
                      borderRadius: '0.3rem',
                      overflow: 'hidden',
                      display: 'flex',
                      position: 'relative',
                    }}
                  >
                    {row.products.map((p, pi) => {
                      const w = maxTotal > 0 ? (p.qty / maxTotal) * 100 : 0;
                      const color = PRODUCT_COLORS[allProducts.indexOf(p.productName) % PRODUCT_COLORS.length];
                      cursor += w;
                      return (
                        <div
                          key={p.productName}
                          title={`${p.productName}: ${p.qty} uds`}
                          style={{
                            width: `${w}%`,
                            height: '100%',
                            background: color,
                            transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                            flexShrink: 0,
                          }}
                        />
                      );
                    })}
                  </div>
                  {/* Total */}
                  <span
                    style={{
                      width: 48,
                      textAlign: 'right',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#0891b2',
                      flexShrink: 0,
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {row.total.toLocaleString('es-GT')} uds
                  </span>
                </div>
              );
            })}
          </div>

          {/* Product color legend */}
          {allProducts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.9rem' }}>
              {allProducts.map((name, idx) => (
                <span
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.7rem',
                    color: '#64748b',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: PRODUCT_COLORS[idx % PRODUCT_COLORS.length],
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  {name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
}
