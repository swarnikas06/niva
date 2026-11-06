import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { OAuthRepository } from './repositories/oauth.repository';
import { User, Session } from '../database/schema';
import { MailService } from '../mail/mail.service';
import { DRIZZLE_DB } from '../database/database.service';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let oauthRepository: jest.Mocked<OAuthRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'niva@test.com',
    passwordHash: '',
    name: 'Niva User',
    avatarUrl: null,
    isEmailVerified: true,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockSession: Session = {
    id: 'session-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'hashed-token-123',
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
  });

  beforeEach(async () => {
    const mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockSessionRepo = {
      create: jest.fn(),
      findValidByTokenHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    const mockOAuthRepo = {
      findByProvider: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
    };

    const mockJwt = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
    };

    const mockConfig = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret-min-32-chars-long';
        if (key === 'JWT_EXPIRES_IN') return '15m';
        if (key === 'REFRESH_TOKEN_EXPIRES_IN') return '30d';
        return defaultVal;
      }),
    };

    const mockMailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
      sendSecurityAlertEmail: jest.fn().mockResolvedValue(true),
      sendAccountDeletionEmail: jest.fn().mockResolvedValue(true),
    };

    const mockDb = {
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: SessionRepository, useValue: mockSessionRepo },
        { provide: OAuthRepository, useValue: mockOAuthRepo },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: MailService, useValue: mockMailService },
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    sessionRepository = module.get(SessionRepository);
    oauthRepository = module.get(OAuthRepository);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should successfully register a new user with hashed password', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser);
      sessionRepository.create.mockResolvedValue(mockSession);

      const result = await authService.register(
        { email: 'niva@test.com', password: 'NewPassword123!', name: 'Niva User' },
        { userAgent: 'test-agent', ipAddress: '127.0.0.1' },
      );

      expect(userRepository.findByEmail).toHaveBeenCalledWith('niva@test.com');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'niva@test.com',
          name: 'Niva User',
        }),
      );
      expect(result.user.email).toBe('niva@test.com');
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw ConflictException if user already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register(
          { email: 'niva@test.com', password: 'NewPassword123!', name: 'Niva User' },
          { userAgent: 'test-agent', ipAddress: '127.0.0.1' },
        ),
      ).rejects.toThrow(ConflictException);

      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should authenticate user with valid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      sessionRepository.create.mockResolvedValue(mockSession);

      const result = await authService.login(
        { email: 'niva@test.com', password: 'CorrectPassword123!' },
        { userAgent: 'test-agent', ipAddress: '127.0.0.1' },
      );

      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException with wrong password', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.login(
          { email: 'niva@test.com', password: 'WrongPassword999!' },
          { userAgent: 'test-agent', ipAddress: '127.0.0.1' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login(
          { email: 'notfound@test.com', password: 'CorrectPassword123!' },
          { userAgent: 'test-agent', ipAddress: '127.0.0.1' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate session and return new tokens', async () => {
      sessionRepository.findValidByTokenHash.mockResolvedValue(mockSession);
      userRepository.findById.mockResolvedValue(mockUser);
      sessionRepository.create.mockResolvedValue({
        ...mockSession,
        id: 'session-uuid-2',
      });

      const result = await authService.refresh('raw-refresh-token', {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(sessionRepository.revoke).toHaveBeenCalledWith(mockSession.id);
      expect(sessionRepository.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException if refresh token is not found or invalid', async () => {
      sessionRepository.findValidByTokenHash.mockResolvedValue(null);

      await expect(
        authService.refresh('invalid-refresh-token', {
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke session when refresh token is provided', async () => {
      sessionRepository.findValidByTokenHash.mockResolvedValue(mockSession);

      await authService.logout('raw-refresh-token');

      expect(sessionRepository.revoke).toHaveBeenCalledWith(mockSession.id);
    });

    it('should succeed silently if refresh token is absent or not found', async () => {
      await expect(authService.logout(undefined)).resolves.not.toThrow();
    });
  });
});
