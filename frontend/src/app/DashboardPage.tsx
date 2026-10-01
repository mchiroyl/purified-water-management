import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../services/apiClient';
import { useOptionalSession } from '../features/auth/SessionContext';
import { PageHeader } from './PageHeader';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { SellerDashboard } from './dashboards/SellerDashboard';
import { WarehouseDashboard } from './dashboards/WarehouseDashboard';

type DashboardAlert = { code: string; severity: string; title: string; count: number };
type Dashboard = {
  generatedAt: string; timezone: string; currencyCode: string;
  salesToday: number; expectedCash: number; deliveredCash: number; transfers: number; credit: number;
  monetaryDifferences: number; inventoryDifferences: number; approvedWasteUnits: number;
  pendingWastes: number; provisionalCustomers: number; pendingTransfers: number;
  activeRoutes: number; completedRoutes: number; pendingOfflineOperations: number;
  pendingReturns: number; pendingAuthorizations: number; openIncidents: number; alerts: DashboardAlert[];
};

type RouteLoadItem = { id: string; productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type RouteLoad = {
  id: string; loadNumber: string; routeId: string; routeCode: string; routeName: string;
  sourceLocationId: string; sourceLocationName: string; targetLocationId: string; targetLocationName: string;
  plannedDate: string; loadType: 'INITIAL' | 'REPLENISHMENT'; status: string;
  sellerReceivedByUsername?: string; createdByUsername: string; items: RouteLoadItem[];
};

type Balance = { productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type Location = {
  id: string; code: string; name: string; locationType: string; routeId?: string; routeCode?: string; routeName?: string;
  active: boolean; balances: Balance[];
};

type SaleItem = { id: string; productName: string; presentationQuantity: number; quantityBaseUnits: number; unitPrice: number; lineTotal: number };
type Payment = { id: string; method: string; amount: number; status: string };
type Sale = {
  id: string; documentNumber: string; routeId?: string; routeCode: string; routeName: string;
  sellerName: string; customerName: string; total: number; createdAt: string;
  items: SaleItem[]; payments?: Payment[];
};

type ProductPresentation = { id: string; code: string; name: string; active: boolean };
type Product = { id: string; code: string; name: string; presentations?: ProductPresentation[] };
type PriceTier = { id: string; presentationId: string; minimumBaseUnits: number; unitPrice: number };
type PriceVersion = { id: string; status: string; tiers: PriceTier[] };
type PriceList = { id: string; status: string; versions: PriceVersion[] };

type SettlementItem = { id: string; productName: string; loadedUnits: number; soldUnits: number; physicalDifference: number };
type Settlement = { id: string; routeLoadId: string; loadNumber: number; routeCode: string; routeName: string; status: string; items: SettlementItem[] };

export function DashboardPage() {
  const client = useQueryClient();
  const session = useOptionalSession();
  const user = session?.user;

  // Determinar rol operativo para mostrar el panel correspondiente
  const isAdminOrSupervisor = !user || user.roles.some(r => r === 'ADMINISTRADOR' || r === 'SUPERVISOR');
  const isSeller = Boolean(user && user.roles.includes('VENDEDOR') && !isAdminOrSupervisor);
  const isWarehouse = Boolean(user && user.roles.includes('BODEGA') && !isAdminOrSupervisor && !isSeller);

  const products = useQuery({ 
    queryKey: ['products'], 
    queryFn: () => apiRequest<Product[]>('/products'),
    enabled: isAdminOrSupervisor
  });

  const priceLists = useQuery({ 
    queryKey: ['pricing', 'lists'], 
    queryFn: () => apiRequest<PriceList[]>('/pricing/lists'),
    enabled: isAdminOrSupervisor
  });

  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<Dashboard>('/dashboard'),
    refetchInterval: 30_000
  });

  const loads = useQuery({
    queryKey: ['route-loads'],
    queryFn: () => apiRequest<RouteLoad[]>('/loads'),
    refetchInterval: 30_000
  });

  const locations = useQuery({
    queryKey: ['inventory', 'locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
    refetchInterval: 30_000
  });

  const sales = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiRequest<Sale[]>('/sales'),
    refetchInterval: 30_000
  });

  const settlements = useQuery({
    queryKey: ['settlements'],
    queryFn: () => apiRequest<Settlement[]>('/settlements'),
    refetchInterval: 30_000
  });

  const isRefreshing = dashboard.isFetching || loads.isFetching || sales.isFetching || locations.isFetching || settlements.isFetching;

  const handleRefresh = () => {
    client.invalidateQueries({ queryKey: ['dashboard'] });
    client.invalidateQueries({ queryKey: ['route-loads'] });
    client.invalidateQueries({ queryKey: ['inventory', 'locations'] });
    client.invalidateQueries({ queryKey: ['sales'] });
    client.invalidateQueries({ queryKey: ['settlements'] });
    if (isAdminOrSupervisor) {
      client.invalidateQueries({ queryKey: ['products'] });
      client.invalidateQueries({ queryKey: ['pricing', 'lists'] });
    }
  };

  const data = dashboard.data;

  return (
    <main>
      {dashboard.error && (
        <div className="alert error" style={{ marginBottom: '1.5rem' }}>
          <strong>Error al cargar panel operativo:</strong> {dashboard.error.message}
        </div>
      )}

      {dashboard.isLoading || !data ? (
        <div>
          <div className="section-heading" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
            <PageHeader 
              eyebrow="Centro de control" 
              title="Panel operativo" 
              description="Cargando indicadores de la jornada…" 
            />
          </div>
          <div className="panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <p className="muted" style={{ fontSize: '1.05rem', margin: 0 }}>Cargando panel operativo...</p>
          </div>
        </div>
      ) : isSeller && user ? (
        <SellerDashboard 
          user={user}
          dashboard={data}
          loads={loads.data ?? []}
          locations={locations.data ?? []}
          sales={sales.data ?? []}
          settlements={settlements.data ?? []}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      ) : isWarehouse && user ? (
        <WarehouseDashboard 
          user={user}
          dashboard={data}
          loads={loads.data ?? []}
          locations={locations.data ?? []}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        <AdminDashboard 
          data={data}
          loads={loads.data ?? []}
          locations={locations.data ?? []}
          sales={sales.data ?? []}
          products={products.data ?? []}
          priceLists={priceLists.data ?? []}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      )}
    </main>
  );
}
