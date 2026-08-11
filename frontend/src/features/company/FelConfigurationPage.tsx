import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../services/apiClient';

type FelConfiguration = {
  id: string;
  enabled: boolean;
  providerCode: string;
  environment: 'TEST' | 'PRODUCTION';
  establishmentCode: string;
  providerAdapterInstalled: boolean;
  credentialsConfigured: boolean;
  activationAvailable: boolean;
  statusMessage: string;
  version: number;
  updatedAt: string;
};

export function FelConfigurationPage() {
  const client = useQueryClient();
  const configuration = useQuery({
    queryKey: ['fel-configuration'],
    queryFn: () => apiRequest<FelConfiguration>('/fel-configuration')
  });
  const activate = useMutation({
    mutationFn: () => apiRequest<FelConfiguration>('/fel-configuration', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: true,
        providerCode: configuration.data?.providerCode ?? '',
        environment: configuration.data?.environment ?? 'TEST',
        establishmentCode: configuration.data?.establishmentCode ?? '',
        version: configuration.data?.version ?? 0
      })
    }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ['fel-configuration'] })
  });

  const item = configuration.data;
  return <main>
    <p className="eyebrow">Configuración fiscal independiente</p>
    <h1>FEL opcional</h1>
    <p className="muted">Esta sección reutiliza la identidad configurada en Datos de la empresa, pero protege por separado proveedor y credenciales.</p>
    <section className="panel section-panel">
      <div className="section-heading"><h2>Estado de certificación</h2><span className="status-pill">{item?.enabled ? 'Activo' : 'Desactivado'}</span></div>
      {configuration.isLoading && <p>Cargando configuración…</p>}
      {configuration.error && <div className="alert error">{configuration.error.message}</div>}
      {item && <>
        <div className="data-list">
          <div className="data-row"><span>Certificador</span><strong>{item.providerCode || 'No configurado'}</strong></div>
          <div className="data-row"><span>Adaptador real instalado</span><strong>{item.providerAdapterInstalled ? 'Sí' : 'No'}</strong></div>
          <div className="data-row"><span>Credenciales seguras validadas</span><strong>{item.credentialsConfigured ? 'Sí' : 'No'}</strong></div>
          <div className="data-row"><span>Ambiente</span><strong>{item.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}</strong></div>
        </div>
        <div className={item.activationAvailable ? 'alert success' : 'alert'}>{item.statusMessage}</div>
        <p><strong>El comprobante interno no es un DTE certificado.</strong> No se simularán certificaciones ni proveedores.</p>
        <button className="primary" disabled={!item.activationAvailable || activate.isPending} onClick={() => activate.mutate()}>Activar FEL</button>
        {activate.error && <div className="alert error">{activate.error.message}</div>}
      </>}
    </section>
  </main>;
}
