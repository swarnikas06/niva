import { Test, TestingModule } from '@nestjs/testing';
import { BehavioralSignalsService } from './behavioral-signals.service';
import { DRIZZLE_DB } from '../database/database.service';

describe('BehavioralSignalsService', () => {
  let service: BehavioralSignalsService;
  let mockDb: any;

  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BehavioralSignalsService,
        {
          provide: DRIZZLE_DB,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<BehavioralSignalsService>(BehavioralSignalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty signals when all counts are zero', async () => {
    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ count: 0 }]),
      }),
    }));

    const signals = await service.detectSignals(mockUserId);
    expect(signals).toEqual([]);
  });

  it('should detect repeated_postponement when postponement count >= 2', async () => {
    let callIdx = 0;
    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(() => {
          callIdx++;
          if (callIdx === 1) return Promise.resolve([{ count: 3 }]); // TaskPostponed
          if (callIdx === 2) return Promise.resolve([{ count: 0 }]); // lifeCommitments overdue
          if (callIdx === 3) return Promise.resolve([{ count: 0 }]); // TaskCompleted
          if (callIdx === 4) return Promise.resolve([{ count: 0 }]); // proactiveActions
          return Promise.resolve([{ count: 0 }]);
        }),
      }),
    }));

    const signals = await service.detectSignals(mockUserId);
    expect(signals.length).toBe(1);
    expect(signals[0]?.type).toBe('repeated_postponement');
    expect(signals[0]?.count).toBe(3);
    expect(signals[0]?.windowDays).toBe(7);
  });

  it('should not detect repeated_postponement when count is 1', async () => {
    let callIdx = 0;
    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(() => {
          callIdx++;
          if (callIdx === 1) return Promise.resolve([{ count: 1 }]); // TaskPostponed
          return Promise.resolve([{ count: 0 }]);
        }),
      }),
    }));

    const signals = await service.detectSignals(mockUserId);
    const postpone = signals.find((s) => s.type === 'repeated_postponement');
    expect(postpone).toBeUndefined();
  });

  it('should detect overdue_commitments when overdue count > 0', async () => {
    let callIdx = 0;
    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(() => {
          callIdx++;
          if (callIdx === 1) return Promise.resolve([{ count: 0 }]);
          if (callIdx === 2) return Promise.resolve([{ count: 2 }]); // overdue commitments
          return Promise.resolve([{ count: 0 }]);
        }),
      }),
    }));

    const signals = await service.detectSignals(mockUserId);
    const overdue = signals.find((s) => s.type === 'overdue_commitments');
    expect(overdue).toBeDefined();
    expect(overdue?.count).toBe(2);
  });

  it('should detect high_momentum when completed task count >= 3', async () => {
    let callIdx = 0;
    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(() => {
          callIdx++;
          if (callIdx === 1) return Promise.resolve([{ count: 0 }]);
          if (callIdx === 2) return Promise.resolve([{ count: 0 }]);
          if (callIdx === 3) return Promise.resolve([{ count: 4 }]); // completed tasks
          return Promise.resolve([{ count: 0 }]);
        }),
      }),
    }));

    const signals = await service.detectSignals(mockUserId);
    const momentum = signals.find((s) => s.type === 'high_momentum');
    expect(momentum).toBeDefined();
    expect(momentum?.count).toBe(4);
  });

  it('should gracefully handle DB errors without throwing', async () => {
    mockDb.select.mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockRejectedValue(new Error('DB Connection Timeout')),
      }),
    }));

    await expect(service.detectSignals(mockUserId)).resolves.toEqual([]);
  });
});
