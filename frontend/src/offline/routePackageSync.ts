import { apiRequest } from '../services/apiClient';
import { getMobileDatabase } from './SyncContext';
import { replaceRoutePackage, type RoutePackage } from './mobileDatabase';

export type RoutePackageStatus = {
  isLoaded: boolean;
  routeId: string | null;
  customerCount: number;
  productCount: number;
  downloadedAt: string | null;
};

export async function downloadAndSaveRoutePackage(routeId: string): Promise<RoutePackage> {
  const data = await apiRequest<RoutePackage>(`/sync/route-package/${routeId}`);
  const db = await getMobileDatabase();
  await replaceRoutePackage(db, data);

  const statusInfo = {
    routeId,
    customerCount: data.customers.length,
    productCount: data.products.length,
    downloadedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`route_package_status_${routeId}`, JSON.stringify(statusInfo));
    localStorage.setItem('route_package_active_route', routeId);
  } catch {
    // localStorage full or restricted
  }

  return data;
}

export async function getStoredRoutePackageStatus(routeId?: string): Promise<RoutePackageStatus> {
  try {
    const activeRouteId = routeId || localStorage.getItem('route_package_active_route');
    if (!activeRouteId) {
      return { isLoaded: false, routeId: null, customerCount: 0, productCount: 0, downloadedAt: null };
    }

    const raw = localStorage.getItem(`route_package_status_${activeRouteId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        isLoaded: true,
        routeId: activeRouteId,
        customerCount: parsed.customerCount || 0,
        productCount: parsed.productCount || 0,
        downloadedAt: parsed.downloadedAt || null,
      };
    }

    const db = await getMobileDatabase();
    const [customers, products] = await Promise.all([
      db.getAll('customers'),
      db.getAll('products'),
    ]);

    if (customers.length > 0 || products.length > 0) {
      return {
        isLoaded: true,
        routeId: activeRouteId,
        customerCount: customers.length,
        productCount: products.length,
        downloadedAt: null,
      };
    }

    return { isLoaded: false, routeId: activeRouteId, customerCount: 0, productCount: 0, downloadedAt: null };
  } catch {
    return { isLoaded: false, routeId: null, customerCount: 0, productCount: 0, downloadedAt: null };
  }
}

export type OfflinePriceDecision = {
  unitPrice: number;
  source: 'CUSTOMER_SPECIAL_PRICE' | 'GENERAL_LIST' | 'FALLBACK';
  isSpecial: boolean;
};

export async function resolveOfflinePrice(
  customerId?: string,
  presentationId?: string,
  quantity = 1,
): Promise<OfflinePriceDecision | null> {
  if (!presentationId) return null;
  try {
    const db = await getMobileDatabase();

    // 1. Revisar si el cliente tiene precio especial activo para esta presentación
    if (customerId) {
      const specialPrices = await db.getAll('specialPrices');
      const special = specialPrices.find(
        sp => sp.customerId === customerId &&
              sp.presentationId === presentationId &&
              sp.status === 'ACTIVE'
      );
      if (special && Number(special.unitPrice) > 0) {
        return {
          unitPrice: Number(special.unitPrice),
          source: 'CUSTOMER_SPECIAL_PRICE',
          isSpecial: true,
        };
      }
    }

    // 2. Revisar escalas de precios por volumen (Price Tiers)
    const tiers = await db.getAll('priceTiers');
    const matchingTiers = tiers
      .filter(t => t.presentationId === presentationId)
      .sort((a, b) => Number(b.minBaseUnits) - Number(a.minBaseUnits));

    const matchedTier = matchingTiers.find(
      t => quantity >= Number(t.minBaseUnits) && (!t.maxBaseUnits || quantity <= Number(t.maxBaseUnits))
    );

    if (matchedTier && Number(matchedTier.unitPrice) > 0) {
      return {
        unitPrice: Number(matchedTier.unitPrice),
        source: 'GENERAL_LIST',
        isSpecial: false,
      };
    }

    // 3. Fallback al tier base si no cuadró en rango exacto
    if (matchingTiers.length > 0 && Number(matchingTiers[matchingTiers.length - 1].unitPrice) > 0) {
      return {
        unitPrice: Number(matchingTiers[matchingTiers.length - 1].unitPrice),
        source: 'GENERAL_LIST',
        isSpecial: false,
      };
    }

    return null;
  } catch (err) {
    console.warn('Error resolviendo precio offline en IndexedDB:', err);
    return null;
  }
}

export async function getOfflineCustomers(routeId?: string) {
  try {
    const db = await getMobileDatabase();
    const all = await db.getAll('customers');
    if (!routeId) return all;
    return all.filter(c => c.routeRunId === routeId || (c as any).routeId === routeId);
  } catch {
    return [];
  }
}

