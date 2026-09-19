export type JugEventType = 'LENT' | 'RETURNED' | 'CHARGED_LOSS' | 'CHARGED_DAMAGE';

export type JugEventRequest = {
  customerId: string;
  routeId: string;
  routeLoadId?: string | null;
  saleId?: string | null;
  eventType: JugEventType;
  quantity: number;
  unitPrice?: number | null;
  notes?: string;
};

export type JugEventResponse = {
  id: string;
  customerId: string;
  customerName: string;
  routeId: string;
  routeName: string;
  routeLoadId?: string | null;
  saleId?: string | null;
  eventType: JugEventType;
  quantity: number;
  unitPrice?: number | null;
  notes: string;
  registeredBy: string;
  registeredByName: string;
  deviceId: string;
  createdAt: string;
};

export type JugBalanceResponse = {
  customerId: string;
  customerName: string;
  routeId: string;
  routeName: string;
  jugsOutstanding: number;
};

export type JugHistoryResponse = {
  customerId: string;
  customerName: string;
  jugsOutstanding: number;
  events: JugEventResponse[];
};

export type JugRouteSummaryResponse = {
  routeId: string;
  routeName: string;
  totalCustomersWithJugs: number;
  totalJugsOutstanding: number;
  customerBalances: JugBalanceResponse[];
};
