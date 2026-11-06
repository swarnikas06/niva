import { Test, TestingModule } from '@nestjs/testing';
import { AiGatewayService } from './ai-gateway.service';
import { BadGatewayException, GatewayTimeoutException, HttpException } from '@nestjs/common';

describe('AiGatewayService', () => {
  let service: AiGatewayService;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiGatewayService],
    }).compile();

    service = module.get<AiGatewayService>(AiGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully return parsed companion AI response', async () => {
    const mockApiResponse = {
      content: 'Hello! I am your companion.',
      provider: 'mock',
      model: 'test-model',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      latencyMs: 42.5,
      requestId: 'test-req-1',
      finishReason: 'stop',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    } as any);

    const result = await service.generateCompanionReply({
      conversationId: '11111111-1111-1111-1111-111111111111',
      userMessage: 'Hi',
      contextFrame: {} as any,
      requestId: 'test-req-1',
    });

    expect(result.content).toBe('Hello! I am your companion.');
    expect(result.provider).toBe('mock');
    expect(result.latencyMs).toBe(42.5);
  });

  it('should throw BadGatewayException on malformed AI response schema', async () => {
    const invalidResponse = {
      content: '', // empty content violates schema
      provider: 'mock',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(invalidResponse),
    } as any);

    await expect(
      service.generateCompanionReply({
        conversationId: '11111111-1111-1111-1111-111111111111',
        userMessage: 'Hi',
        contextFrame: {} as any,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('should throw HttpException with 429 when AI service returns rate limit error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({ detail: 'Rate limit exceeded' }),
    } as any);

    await expect(
      service.generateCompanionReply({
        conversationId: '11111111-1111-1111-1111-111111111111',
        userMessage: 'Hi',
        contextFrame: {} as any,
      }),
    ).rejects.toThrow(HttpException);
  });

  it('should throw GatewayTimeoutException on 504 status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: jest.fn().mockResolvedValue({ detail: 'Timeout' }),
    } as any);

    await expect(
      service.generateCompanionReply({
        conversationId: '11111111-1111-1111-1111-111111111111',
        userMessage: 'Hi',
        contextFrame: {} as any,
      }),
    ).rejects.toThrow(GatewayTimeoutException);
  });
});
