import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultVal?: string) => defaultVal || 'test'),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return liveness status', () => {
    const liveness = controller.getLiveness();
    expect(liveness.service).toBe('niva-api');
    expect(liveness.status).toBe('healthy');
    expect(liveness.version).toBe('0.1.0');
    expect(typeof liveness.uptimeSeconds).toBe('number');
  });

  it('should return readiness structure', async () => {
    jest.spyOn(service, 'getReadiness').mockResolvedValue({
      service: 'niva-api',
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 10,
      environment: 'test',
      ready: true,
      dependencies: {
        postgres: { status: 'healthy', lastChecked: new Date().toISOString() },
        redis: { status: 'healthy', lastChecked: new Date().toISOString() },
      },
    });

    const readiness = await controller.getReadiness();
    expect(readiness.ready).toBe(true);
    expect(readiness.dependencies.postgres?.status).toBe('healthy');
    expect(readiness.dependencies.redis?.status).toBe('healthy');
  });

  it('should return combined readiness on root getHealth', async () => {
    jest.spyOn(service, 'getReadiness').mockResolvedValue({
      service: 'niva-api',
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 15,
      environment: 'test',
      ready: true,
      dependencies: {
        postgres: { status: 'healthy', lastChecked: new Date().toISOString() },
        redis: { status: 'healthy', lastChecked: new Date().toISOString() },
      },
    });

    const health = await controller.getHealth();
    expect(health.ready).toBe(true);
    expect(health.service).toBe('niva-api');
  });
});
