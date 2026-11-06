/**
 * NIVA Health Status Interfaces (Phase 0 Foundation)
 */

export type ServiceHealthStatus = 'healthy' | 'unhealthy' | 'degraded';

export interface ComponentHealth {
  status: ServiceHealthStatus;
  message?: string;
  latencyMs?: number;
  lastChecked: string;
}

export interface HealthCheckResponse {
  service: string;
  status: ServiceHealthStatus;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  components?: Record<string, ComponentHealth>;
}

export interface ReadinessCheckResponse extends HealthCheckResponse {
  ready: boolean;
  dependencies: {
    postgres?: ComponentHealth;
    redis?: ComponentHealth;
    aiService?: ComponentHealth;
  };
}
