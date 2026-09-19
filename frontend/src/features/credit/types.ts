export type CreditPaymentMethod = 'CASH' | 'TRANSFER';
export type CreditPaymentStatus = 'CONFIRMED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export type CreditPaymentRequest = {
  customerId: string;
  routeLoadId?: string | null;
  amount: number;
  paymentMethod: CreditPaymentMethod;
  reference?: string;
  bank?: string;
  notes?: string;
};

export type CreditPaymentResponse = {
  id: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  routeLoadId?: string | null;
  amount: number;
  paymentMethod: CreditPaymentMethod;
  status: CreditPaymentStatus;
  reference: string;
  bank: string;
  rejectionReason: string;
  notes: string;
  collectedBy: string;
  collectedByName: string;
  deviceId: string;
  verifiedBy?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
};

export type CreditDecisionRequest = {
  decision: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
};

export type CreditStatementEntryResponse = {
  id: string;
  entryType: 'SALE_CHARGE' | 'SALE_VOID' | 'CREDIT_PAYMENT';
  amount: number;
  balanceAfter: number;
  occurredAt: string;
  documentOrReference: string;
  description: string;
  createdByName: string;
};

export type CreditStatementResponse = {
  customerId: string;
  customerName: string;
  customerCode: string;
  creditAllowed: boolean;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  entries: CreditStatementEntryResponse[];
};

export type CreditBalanceResponse = {
  customerId: string;
  customerName: string;
  customerCode: string;
  creditAllowed: boolean;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
};

export type CreditRoutePendingResponse = {
  routeId: string;
  routeName: string;
  totalDebtors: number;
  totalDebt: number;
  debtors: CreditBalanceResponse[];
};
