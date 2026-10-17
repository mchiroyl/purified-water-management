import { useEffect, useRef } from 'react';
import { Flag, Check, ShoppingCart, AlertTriangle, Navigation, MapPin, X, Building2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DailyItineraryStopResponse } from './types';

// Fix Leaflet default marker icon paths broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

function makeNumberIcon(order: number, color: string, isCompleted = false, isBlocked = false, isNoPurchase = false) {
  let innerHtml = `<span style="font-size:13px;font-weight:800;letter-spacing:-0.5px;">${order}</span>`;
  if (isCompleted) {
    innerHtml = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (isBlocked) {
    innerHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  } else if (isNoPurchase) {
    innerHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  }

  const border = isCompleted ? '2px solid #cbd5e1' : '3px solid #ffffff';
  const shadow = isCompleted ? '0 1px 3px rgba(0,0,0,0.15)' : '0 3px 8px rgba(2, 132, 199, 0.4)';
  const opacity = isCompleted ? '0.78' : '1';

  return L.divIcon({
    className: '',
    html: `<div style="
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: ${color};
      border: ${border};
      box-shadow: ${shadow};
      opacity: ${opacity};
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      transition: transform 0.15s ease;
    ">${innerHtml}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

const START_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #059669;
    border: 3px solid #ffffff;
    box-shadow: 0 3px 8px rgba(5, 150, 105, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const RETURN_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #7c3aed;
    border: 3px solid #ffffff;
    box-shadow: 0 3px 12px rgba(124, 58, 237, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

export interface VendorItineraryMapProps {
  start?: { latitude: number; longitude: number; label?: string } | null;
  stops: DailyItineraryStopResponse[];
  height?: string;
  onNavigateToSale?: (customerId: string) => void;
}

export function VendorItineraryMap({
  start,
  stops,
  height = '340px',
  onNavigateToSale,
}: VendorItineraryMapProps) {
  const mapContainerId = useRef(`itinerary-map-${Math.random().toString(36).slice(2)}`);
  const mapRef = useRef<L.Map | null>(null);

  // Filter stops with valid non-zero coordinates and sort by stopOrder
  const sortedStops = [...stops]
    .filter((s) => s.targetLatitude != null && s.targetLongitude != null && Number(s.targetLatitude) !== 0 && Number(s.targetLongitude) !== 0)
    .sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0));

  const allStopsAttended = sortedStops.length > 0 && sortedStops.every(
    (s) => s.status === 'ATTENDED_SALE' || s.status === 'ATTENDED_NO_PURCHASE' || s.status === 'POSTPONED_BLOCKED'
  );
  // El retorno a bodega solo se activa cuando TODOS los clientes han sido atendidos o reportados
  const isReturnActive = allStopsAttended;

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const container = document.getElementById(mapContainerId.current);
    if (!container) return;

    const allPoints: L.LatLng[] = [];

    // Initialize map
    const map = L.map(mapContainerId.current, { zoomControl: true });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // 1. Start marker (Bodega / Salida)
    let previousPoint: L.LatLng | null = null;
    let startLl: L.LatLng | null = null;
    if (start && start.latitude != null && start.longitude != null) {
      startLl = L.latLng(Number(start.latitude), Number(start.longitude));
      allPoints.push(startLl);
      previousPoint = startLl;

      const startMarker = L.marker(startLl, { icon: isReturnActive ? RETURN_ICON : START_ICON }).addTo(map);
      const startPopup = isReturnActive
        ? `
          <div style="font-family:inherit;padding:2px;min-width:180px;">
            <div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;">Destino Final</div>
            <strong style="color:#0f172a;font-size:13px;display:block;margin:2px 0;">🏢 Bodega / Planta Central</strong>
            <div style="margin:4px 0 6px 0;">
              <span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;">
                🏁 Retorno Activo (Liquidar Jornada)
              </span>
            </div>
            <p style="font-size:11px;color:#475569;margin:0 0 6px 0;line-height:1.3;">
              Todos los clientes fueron visitados. Regresa a bodega para entrega de valores y cierre.
            </p>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${start.latitude},${start.longitude}" target="_blank" rel="noopener noreferrer" style="
              background:#7c3aed;color:#ffffff;text-decoration:none;
              font-size:11px;font-weight:700;padding:4px 9px;border-radius:4px;
              display:inline-flex;align-items:center;gap:3px;
            ">📍 Guiar Retorno con GPS</a>
          </div>
        `
        : `
          <div style="font-family:inherit;padding:2px;">
            <strong style="color:#059669;font-size:13px;display:block;">🚩 Inicio del Recorrido</strong>
            <span style="font-size:11px;color:#64748b;">${escapeHtml(start.label || 'Punto de partida del camión')}</span>
          </div>
        `;
      startMarker.bindPopup(startPopup);
    }

    // 2. Stops and Path segments
    for (const stop of sortedStops) {
      const stopLl = L.latLng(Number(stop.targetLatitude), Number(stop.targetLongitude));
      allPoints.push(stopLl);

      const isCompleted = stop.status === 'ATTENDED_SALE';
      const isNoPurchase = stop.status === 'ATTENDED_NO_PURCHASE';
      const isBlocked = stop.status === 'POSTPONED_BLOCKED';

      // Draw polyline segment from previous point to this stop:
      // METÁFORA: Los tramos visitados/atendidos se ponen en GRIS (consumido), los pendientes en COLOR azul vivo.
      if (previousPoint) {
        if (isCompleted || isNoPurchase) {
          // Tramo consumido -> GRIS punteado
          L.polyline([previousPoint, stopLl], {
            color: '#94a3b8',
            weight: 3.5,
            opacity: 0.65,
            dashArray: '5, 5',
          }).addTo(map);
        } else if (isBlocked) {
          // Tramo con bloqueo -> Ámbar punteado
          L.polyline([previousPoint, stopLl], {
            color: '#f59e0b',
            weight: 3.5,
            opacity: 0.75,
            dashArray: '4, 4',
          }).addTo(map);
        } else {
          // Tramo activo pendiente -> COLOR VIVO azul continuo
          L.polyline([previousPoint, stopLl], {
            color: '#0284c7',
            weight: 4.5,
            opacity: 0.9,
          }).addTo(map);
        }
      }
      previousPoint = stopLl;

      // Color del marcador según estado:
      // Visitado/Vendido -> Gris (#94a3b8)
      // No compró -> Gris neutro (#64748b)
      // Bloqueado -> Naranja ámbar (#d97706)
      // Pendiente -> Color azul vivo (#0284c7)
      let markerColor = '#0284c7';
      if (isCompleted) markerColor = '#94a3b8';
      else if (isNoPurchase) markerColor = '#64748b';
      else if (isBlocked) markerColor = '#d97706';

      const markerIcon = makeNumberIcon(
        stop.stopOrder,
        markerColor,
        isCompleted,
        isBlocked,
        isNoPurchase
      );

      const marker = L.marker(stopLl, { icon: markerIcon }).addTo(map);

      // Popup de información y acciones
      const customerName = escapeHtml(stop.customerName || 'Cliente');
      const address = escapeHtml(stop.addressReference || '');
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.targetLatitude},${stop.targetLongitude}`;

      let statusBadge = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#e0f2fe;color:#0284c7;">⏳ Pendiente de visita</span>`;
      if (isCompleted) {
        statusBadge = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#f1f5f9;color:#64748b;text-decoration:line-through;">✅ Venta completada (Consumido)</span>`;
      } else if (isNoPurchase) {
        statusBadge = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#f1f5f9;color:#64748b;">⚪ Visita sin compra</span>`;
      } else if (isBlocked) {
        statusBadge = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#fef3c7;color:#b45309;">⚠️ Calle bloqueada</span>`;
      }

      const popupContent = `
        <div style="font-family:inherit;min-width:180px;padding:2px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Parada #${stop.stopOrder}</div>
          <strong style="font-size:13px;color:#0f172a;display:block;margin:1px 0 4px 0;">${customerName}</strong>
          ${address ? `<div style="font-size:11px;color:#475569;margin-bottom:6px;line-height:1.3;">${address}</div>` : ''}
          <div style="margin-bottom:8px;">${statusBadge}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid #f1f5f9;padding-top:6px;">
            <a href="/sales?customerId=${stop.customerId}" style="
              background:#0284c7;color:#ffffff;text-decoration:none;
              font-size:11px;font-weight:700;padding:4px 9px;border-radius:4px;
              display:inline-flex;align-items:center;gap:3px;
            ">🛒 Vender</a>
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="
              background:#f8fafc;color:#334155;border:1px solid #cbd5e1;text-decoration:none;
              font-size:11px;font-weight:600;padding:4px 8px;border-radius:4px;
              display:inline-flex;align-items:center;gap:3px;
            ">📍 GPS</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
    }

    // 3. Trazado de RETORNO a Bodega / Planta (Desde la última parada hacia el origen)
    if (startLl && sortedStops.length > 0) {
      const lastStopObj = sortedStops[sortedStops.length - 1];
      const lastStopLl = L.latLng(Number(lastStopObj.targetLatitude), Number(lastStopObj.targetLongitude));

      if (isReturnActive) {
        // Trazado de RETORNO ACTIVO: Violeta intenso (#7c3aed), trazo grueso con guión
        L.polyline([lastStopLl, startLl], {
          color: '#7c3aed',
          weight: 5,
          opacity: 0.95,
          dashArray: '8, 6',
        }).addTo(map);
      } else {
        // Trazado de retorno planificado previo (Violeta suave punteado)
        L.polyline([lastStopLl, startLl], {
          color: '#c4b5fd',
          weight: 2.5,
          opacity: 0.65,
          dashArray: '4, 8',
        }).addTo(map);
      }
    }

    // Auto-fit all points
    if (allPoints.length > 0) {
      if (allPoints.length === 1) {
        map.setView(allPoints[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [28, 28] });
      }
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [start, stops, isReturnActive]);

  return (
    <div style={{
      background: '#ffffff',
      border: isReturnActive ? '2px solid #a78bfa' : '1px solid #e2e8f0',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: isReturnActive ? '0 4px 14px rgba(124, 58, 237, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '1rem',
      transition: 'all 0.2s ease',
    }}>
      {/* Banner de retorno activo si ya se visitó el último cliente */}
      {isReturnActive && (
        <div style={{
          background: 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)',
          color: '#ffffff',
          padding: '0.6rem 0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.4rem',
          fontSize: '0.82rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.05rem' }}>🏁</span>
            <strong>¡Clientes completados! Ruta de retorno a Bodega activa</strong>
          </div>
          <span style={{ fontSize: '0.76rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
            Línea Violeta ➔ Bodega Central
          </span>
        </div>
      )}

      {/* Barra superior de leyenda */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.6rem 0.9rem',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.78rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontWeight: 600 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
            Ruta activa
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b', fontWeight: 600 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
            Consumido (Gris)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#7c3aed', fontWeight: 700 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
            Retorno a Bodega (Violeta)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontWeight: 600 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
            Bloqueado
          </span>
        </div>
        <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
          Toca cualquier cliente para ver detalles o vender
        </span>
      </div>

      {/* Contenedor del Mapa Leaflet */}
      <div
        id={mapContainerId.current}
        style={{
          width: '100%',
          height,
          zIndex: 1,
          background: '#f1f5f9',
        }}
      />
    </div>
  );
}
