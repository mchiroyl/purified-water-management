export type Customer = {
  id: string; code: string; name: string; contactName: string; phone: string; whatsapp: string;
  addressReference: string; customerType: string; status: string; creditAllowed: boolean;
  creditLimit: number; currentBalance: number; routeId?: string; routeCode?: string; routeName?: string;
  sellerId?: string; sellerName?: string; registrationState: string; createdAt: string;
};
export type Route = {
  id: string; code: string; name: string; description: string; status: string; sellerId?: string;
  sellerCode?: string; sellerName?: string; vehicleId?: string; vehicleCode?: string;
  licensePlate?: string; customerCount: number; assignmentValidFrom?: string; createdAt: string;
};
export type Vehicle = { id: string; code: string; licensePlate?: string; description: string; status: string; createdAt: string };
export type Seller = { id: string; code: string; displayName: string; status: string };
export type DuplicateCandidate = { id: string; code: string; name: string; phone: string; whatsapp: string };
export type ProvisionalReview = { customer: Customer; duplicateCandidates: DuplicateCandidate[] };

export function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export type DailyItineraryStopResponse = {
  id: string;
  runId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  contactPhone?: string | null;
  addressReference?: string | null;
  targetLatitude?: number | null;
  targetLongitude?: number | null;
  stopOrder: number;
  instructions?: string | null;
  status: 'PENDING' | 'ATTENDED_SALE' | 'ATTENDED_NO_PURCHASE' | 'POSTPONED_BLOCKED';
  attendedAt?: string | null;
  saleId?: string | null;
  noPurchaseReason?: string | null;
  noPurchaseNote?: string | null;
  postponeReason?: string | null;
  observedLatitude?: number | null;
  observedLongitude?: number | null;
  observedAccuracyMeters?: number | null;
  hasLocationMismatch: boolean;
  distanceDeviationMeters?: number | null;
  evidencePhoto?: string | null;
  evidencePhotoCapturedAt?: string | null;
};

export type DailyItineraryRunResponse = {
  id: string;
  routeId: string;
  routeCode?: string | null;
  routeName?: string | null;
  routeLoadId?: string | null;
  sellerUserId: string;
  planDate: string;
  status: 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED_INCOMPLETE';
  totalStops: number;
  completedStops: number;
  publishedAt: string;
  closedAt?: string | null;
  stops: DailyItineraryStopResponse[];
};

