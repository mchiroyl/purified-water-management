import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../services/apiClient';
import { MapPin, CheckCircle2, History, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface Props {
  customerId: string;
  customerName: string;
  onClose: () => void;
}

interface HistoricalPoint {
  id: string;
  pointType: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt: string;
  referenceText: string;
}

interface ConfirmedLocation {
  id: string;
  customerId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  sourceType: string;
  notes?: string;
  confirmedAt: string;
  status: string;
}

export function CustomerLocationModal({ customerId, customerName, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedLat, setSelectedLat] = useState<string>('');
  const [selectedLon, setSelectedLon] = useState<string>('');
  const [accuracy, setAccuracy] = useState<string>('15');
  const [sourceType, setSourceType] = useState<string>('HISTORICAL_SALE');
  const [sourceRefId, setSourceRefId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');

  const confirmedQuery = useQuery({
    queryKey: ['confirmed-location', customerId],
    queryFn: async () => {
      try {
        return await apiRequest<ConfirmedLocation>(`/customers/${customerId}/confirmed-location`);
      } catch {
        return null;
      }
    },
  });

  const historicalQuery = useQuery({
    queryKey: ['historical-points', customerId],
    queryFn: () => apiRequest<HistoricalPoint[]>(`/customers/${customerId}/historical-points`),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { latitude: number; longitude: number; accuracyMeters?: number; sourceType: string; sourceReferenceId?: string | null; notes: string }) =>
      apiRequest<ConfirmedLocation>(`/customers/${customerId}/confirmed-location`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setSaveSuccess('Ubicación confirmada guardada correctamente.');
      queryClient.invalidateQueries({ queryKey: ['confirmed-location', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setTimeout(() => {
        setSaveSuccess('');
      }, 4000);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar la ubicación');
    },
  });

  const handleSelectHistorical = (p: HistoricalPoint) => {
    setSelectedLat(String(p.latitude));
    setSelectedLon(String(p.longitude));
    setAccuracy(p.accuracyMeters != null ? String(p.accuracyMeters) : '15');
    setSourceType(p.pointType === 'SALE' ? 'HISTORICAL_SALE' : 'HISTORICAL_VISIT');
    setSourceRefId(p.id);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    const lat = Number(selectedLat);
    const lon = Number(selectedLon);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setSaveError('Latitud inválida (debe estar entre -90 y 90).');
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setSaveError('Longitud inválida (debe estar entre -180 y 180).');
      return;
    }

    saveMutation.mutate({
      latitude: lat,
      longitude: lon,
      accuracyMeters: accuracy ? Number(accuracy) : 15,
      sourceType,
      sourceReferenceId: sourceRefId,
      notes: notes.trim(),
    });
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '1.5rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} style={{ color: '#0284c7' }} /> Ubicación Confirmada de Cliente
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>{customerName}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} style={{ color: '#64748b' }} />
          </button>
        </div>

        {/* Current status */}
        {confirmedQuery.data && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} style={{ color: '#047857', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#065f46' }}>
              <strong>Ubicación actualmente confirmada:</strong> Lat: <span style={{ fontFeatureSettings: '"tnum"' }}>{confirmedQuery.data.latitude}</span>, Lon: <span style={{ fontFeatureSettings: '"tnum"' }}>{confirmedQuery.data.longitude}</span>
              {confirmedQuery.data.accuracyMeters != null && ` (±${confirmedQuery.data.accuracyMeters}m)`} · Origen: {confirmedQuery.data.sourceType}
            </div>
          </div>
        )}

        {/* Historical Points Selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={16} /> Puntos Históricos de Ventas y Visitas
          </h3>
          {historicalQuery.isLoading ? (
            <p className="muted" style={{ fontSize: '0.8rem' }}>Cargando historial de puntos...</p>
          ) : !historicalQuery.data?.length ? (
            <p className="muted" style={{ fontSize: '0.8rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
              No hay puntos históricos registrados para este cliente aún. Puede ingresar coordenadas manuales abajo.
            </p>
          ) : (
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              {historicalQuery.data.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectHistorical(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                    background: selectedLat === String(p.latitude) && selectedLon === String(p.longitude) ? '#f0f9ff' : '#fff',
                  }}
                  title="Haga clic para usar este punto histórico"
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: p.pointType === 'SALE' ? '#0284c7' : '#64748b' }}>
                      {p.pointType === 'SALE' ? 'Venta' : 'Visita'}
                    </span>
                    <span>{p.referenceText}</span>
                  </div>
                  <div style={{ color: '#64748b', fontFeatureSettings: '"tnum"' }}>
                    {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Latitud *
              </label>
              <input
                type="number"
                step="any"
                required
                value={selectedLat}
                onChange={(e) => setSelectedLat(e.target.value)}
                placeholder="Ej. 14.6349"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFeatureSettings: '"tnum"' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Longitud *
              </label>
              <input
                type="number"
                step="any"
                required
                value={selectedLon}
                onChange={(e) => setSelectedLon(e.target.value)}
                placeholder="Ej. -90.5069"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFeatureSettings: '"tnum"' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Precisión (metros)
              </label>
              <input
                type="number"
                value={accuracy}
                onChange={(e) => setAccuracy(e.target.value)}
                placeholder="15"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Origen de confirmación
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="HISTORICAL_SALE">Venta histórica</option>
                <option value="HISTORICAL_VISIT">Visita histórica</option>
                <option value="ADMIN_MANUAL">Revisión manual administrativa</option>
                <option value="FIELD_AUDIT">Auditoría en campo</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Notas u observaciones
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Casa portón verde esquinera, verificado con el cliente"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {saveSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} /> {saveSuccess}
            </div>
          )}
          {saveError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {saveError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="secondary" onClick={onClose} style={{ minHeight: '44px' }}>
              Cerrar
            </button>
            <button type="submit" className="primary" disabled={saveMutation.isPending} style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> {saveMutation.isPending ? 'Guardando...' : 'Confirmar Ubicación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
