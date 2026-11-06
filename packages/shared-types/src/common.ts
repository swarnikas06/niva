/**
 * Common System Enums and Types
 */

export type EnvironmentMode = 'development' | 'test' | 'staging' | 'production';

export type AIProviderType = 'gemini';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}
