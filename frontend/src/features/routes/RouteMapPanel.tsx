import { useEffect, useRef } from 'react';
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

function makeIcon(color: string, symbol: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50%;background:${color};
      border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;line-height:1;
    ">${symbol}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

const START_ICON = makeIcon('#16a34a', '🏁');
const SALE_ICON  = makeIcon('#2563eb', '💧');
const VISIT_ICON = makeIcon('#6b7280', '🚶');

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

    // Tile layer — OpenStreetMap (100% free, no API key)
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
          `<b>💧 Venta</b>`,
          point.documentNumber ? `<span>${point.documentNumber}</span>` : '',
          point.saleTotal != null ? `<b>${formatMoney(Number(point.saleTotal))}</b>` : '',
          `<small>${formatTime(point.capturedAt)}</small>`,
          point.accuracyMeters != null ? `<small>Precisión ±${Number(point.accuracyMeters).toFixed(0)} m</small>` : '',
        ].filter(Boolean).join('<br>');
      } else {
        // NO_PURCHASE_VISIT
        marker = L.marker(ll, { icon: VISIT_ICON });
        popupHtml = [
          `<b>🚶 Visita sin compra</b>`,
          point.customerName ? `<span>${point.customerName}</span>` : '',
          point.visitNote ? `<i>${point.visitNote}</i>` : '',
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
      <div className="route-map-summary">
        <span>🟢 Inicio</span>
        <span>💧 {data.salesCount} ventas · {formatMoney(Number(data.totalAmount))}</span>
        <span>🚶 {data.noPurchaseVisitCount} visitas sin compra</span>
        <span>⏱ {Math.floor(data.durationMinutes / 60)}h {data.durationMinutes % 60}m</span>
      </div>

      {/* Legend */}
      <div className="route-map-legend">
        <span><span style={{ background: '#16a34a' }} className="legend-dot" />Inicio</span>
        <span><span style={{ background: '#2563eb' }} className="legend-dot" />Venta</span>
        <span><span style={{ background: '#6b7280' }} className="legend-dot" />Visita sin compra</span>
      </div>

      {/* Leaflet container */}
      <div id={mapId.current} style={{ height, width: '100%', borderRadius: '8px', zIndex: 0 }} />

      {/* Point list */}
      <div className="data-list route-point-list" style={{ marginTop: '0.75rem', maxHeight: '260px', overflowY: 'auto' }}>
        <p className="muted" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', margin: 0 }}>
          💡 Haga clic en cualquier parada para centrarla en el mapa con sus detalles:
        </p>
        {data.points.map((p, i) => (
          <div
            className="data-row"
            key={i}
            style={{ cursor: 'pointer' }}
            onClick={() => focusPoint(i, Number(p.latitude), Number(p.longitude))}
            title="Centrar en el mapa"
          >
            <span style={{ minWidth: '22px', textAlign: 'center' }}>
              {p.pointType === 'START' ? '🏁' : p.pointType === 'SALE' ? '💧' : '🚶'}
            </span>
            <span>{formatTime(p.capturedAt)}</span>
            <span>
              {p.pointType === 'START' && 'Inicio de ruta'}
              {p.pointType === 'SALE' && (p.documentNumber || 'Venta')}
              {p.pointType === 'NO_PURCHASE_VISIT' && (p.customerName || 'Visita sin compra')}
            </span>
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {p.pointType === 'SALE' && p.saleTotal != null && formatMoney(Number(p.saleTotal))}
              {p.pointType === 'NO_PURCHASE_VISIT' && p.visitNote}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
