import { PageHeader } from '../../app/PageHeader';
import { VendorItineraryPanel } from './VendorItineraryPanel';
import { useOptionalSession } from '../auth/SessionContext';

export function VendorItineraryPage() {
  const session = useOptionalSession();
  const isSeller = Boolean(session?.user?.roles.includes('VENDEDOR'));

  return (
    <main>
      <PageHeader
        eyebrow="Operación en ruta"
        title="Recorrido Diario Ordenado"
        description="Secuencia de clientes ordenada por la administración, navegación GPS y registro de paradas."
      />
      <VendorItineraryPanel isSeller={isSeller} />
    </main>
  );
}
