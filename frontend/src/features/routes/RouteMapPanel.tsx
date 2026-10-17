import { useEffect, useRef } from 'react';
import { Flag, Droplet, UserCheck, Clock, Info } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon paths broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export type RouteMapPoint = {
  pointType: string;       // 'START' | 'SALE' | 'NO_PURCHASE_VISIT'
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
  documentNumber?: string | null;
  saleTotal?: number | null;
  customerName?: string | null;
  visitNote?: string | null;
};

export type RouteMapData = {
  sellerName: string;
  routeName: string;
  date: string;
  salesCount: number;
  noPurchaseVisitCount: number;
  totalAmount: number;
  durationMinutes: number;
  points: RouteMapPoint[];
};

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

function makeSvgIcon(color: string, svgContent: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50%;background:${color};
      border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      color:#fff;
    ">${svgContent}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

const START_ICON = makeSvgIcon(
  '#059669',
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
);
const SALE_ICON = makeSvgIcon(
  '#0284c7',
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`
);
const VISIT_ICON = makeSvgIcon(
  '#64748b',
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
}

function formatMoney(value: number) {
  return `Q${Number(value).toFixed(2)}`;
}

interface Props {
  data: RouteMapData;
  height?: string;
}

export function RouteMapPanel({ data, height = '480px' }: Props) {
  const mapId = useRef(`leaflet-map-${Math.random().toString(36).slice(2)}`);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current = [];
    if (!data.points.length) return;

    const map = L.map(mapId.current, { zoomControl: true, attributionControl: true });
    mapRef.current = map;

    // Tile layer — OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const latLngs: L.LatLng[] = [];

    for (const point of data.points) {
      const ll = L.latLng(Number(point.latitude), Number(point.longitude));
      latLngs.push(ll);

      let marker: L.Marker;
      let popupHtml: string;

      if (point.pointType === 'START') {
        marker = L.marker(ll, { icon: START_ICON });
        popupHtml = `<b>Inicio de ruta</b><br>${formatTime(point.capturedAt)}`;
      } else if (point.pointType === 'SALE') {
        marker = L.marker(ll, { icon: SALE_ICON });
        popupHtml = [
          `<b>Venta confirmada</b>`,
          point.documentNumber ? `<span>${escapeHtml(point.documentNumber)}</span>` : '',
          point.saleTotal != null ? `<b>${formatMoney(Number(point.saleTotal))}</b>` : '',
          `<small>${formatTime(point.capturedAt)}</small>`,
          point.accuracyMeters != null ? `<small>Precisión ±${Number(point.accuracyMeters).toFixed(0)} m</small>` : '',
        ].filter(Boolean).join('<br>');
      } else {
        // NO_PURCHASE_VISIT
        marker = L.marker(ll, { icon: VISIT_ICON });
        popupHtml = [
          `<b>Visita sin compra</b>`,
          point.customerName ? `<span>${escapeHtml(point.customerName)}</span>` : '',
          point.visitNote ? `<i>${escapeHtml(point.visitNote)}</i>` : '',
          `<small>${formatTime(point.capturedAt)}</small>`,
        ].filter(Boolean).join('<br>');
      }

      marker.addTo(map).bindPopup(popupHtml);
      markersRef.current.push(marker);
    }

    // Draw polyline connecting all points in chronological order
    if (latLngs.length > 1) {
      L.polyline(latLngs, { color: '#2563eb', weight: 3, opacity: 0.75, dashArray: '6, 4' }).addTo(map);
    }

    // Auto-fit bounds
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data.points.length) {
    return <p className="muted">No hay puntos GPS registrados para este recorrido.</p>;
  }

  const focusPoint = (idx: number, lat: number, lon: number) => {
    if (!mapRef.current) return;
    mapRef.current.setView([lat, lon], 17, { animate: true });
    markersRef.current[idx]?.openPopup();
  };

  return (
    <div>
      {/* Summary row */}
      <div className="route-map-summary" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Flag size={14} style={{ color: '#059669' }} /> Inicio
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Droplet size={14} style={{ color: '#0284c7' }} /> {data.salesCount} ventas · {formatMoney(Number(data.totalAmount))}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <UserCheck size={14} style={{ color: '#64748b' }} /> {data.noPurchaseVisitCount} visitas sin compra
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={14} style={{ color: '#94a3b8' }} /> {Math.floor(data.durationMinutes / 60)}h {data.durationMinutes % 60}m
        </span>
      </div>

      {/* Legend */}
      <div className="route-map-legend" style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <span><span style={{ background: '#059669' }} className="legend-dot" />Inicio</span>
        <span><span style={{ background: '#0284c7' }} className="legend-dot" />Venta</span>
        <span><span style={{ background: '#64748b' }} className="legend-dot" />Visita sin compra</span>
      </div>

      {/* Leaflet container */}
      <div id={mapId.current} style={{ height, width: '100%', borderRadius: '8px', zIndex: 0 }} />

      {/* Point list */}
      <div className="data-list route-point-list" style={{ marginTop: '0.75rem', maxHeight: '260px', overflowY: 'auto' }}>
        <p className="muted" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={14} /> Seleccione cualquier parada para centrarla en el mapa con sus detalles:
        </p>
        {data.points.map((p, i) => (
          <div
            className="data-row"
            key={i}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => focusPoint(i, Number(p.latitude), Number(p.longitude))}
            title="Centrar en el mapa"
          >
            <span style={{ minWidth: '22px', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.pointType === 'START' ? (
                <Flag size={14} style={{ color: '#059669' }} />
              ) : p.pointType === 'SALE' ? (
                <Droplet size={14} style={{ color: '#0284c7' }} />
              ) : (
                <UserCheck size={14} style={{ color: '#64748b' }} />
              )}
            </span>
            <span style={{ fontFeatureSettings: '"tnum"' }}>{formatTime(p.capturedAt)}</span>
            <span>
              {p.pointType === 'START' && 'Inicio de ruta'}
              {p.pointType === 'SALE' && (p.documentNumber || 'Venta')}
              {p.pointType === 'NO_PURCHASE_VISIT' && (p.customerName || 'Visita sin compra')}
            </span>
            <span className="muted" style={{ fontSize: '0.82rem', marginLeft: 'auto', fontFeatureSettings: '"tnum"' }}>
              {p.pointType === 'SALE' && p.saleTotal != null && formatMoney(Number(p.saleTotal))}
              {p.pointType === 'NO_PURCHASE_VISIT' && p.visitNote}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
