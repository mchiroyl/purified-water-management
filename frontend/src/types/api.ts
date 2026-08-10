export interface ApiErrorPayload {
  code: string;
  message: string;
  correlationId: string;
  timestamp: string;
  fieldErrors?: Array<{ field: string; message: string }>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiErrorPayload
  ) {
    super(payload.message);
  }
}
