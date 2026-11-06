/**
 * Standard NIVA API Response and Error Contract
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  meta?: ApiResponseMeta;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path?: string;
  correlationId?: string;
}

export interface ApiResponseMeta {
  timestamp: string;
  requestId?: string;
  version: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
