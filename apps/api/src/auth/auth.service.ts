import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { OAuthRepository } from './repositories/oauth.repository';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import { User, NewUser } from '../database/schema';
import {
  RegisterInput,
  LoginInput,
  RegisterSchema,
  LoginSchema,
} from '@niva/validation';
import { UserDto, UserStatus } from '@niva/shared-types';
import { UpdateProfileDto } from './dto/account-lifecycle.dto';
import { MailService } from '../mail/mail.service';

export interface ClientContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;
  private redis?: Redis;
  private readonly tokenStore = new Map<string, { value: any; expiresAt: number }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly oauthRepository: OAuthRepository,
    private readonly mailService: MailService,
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    try {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      this.redis.connect().catch(() => {
        this.logger.debug('Redis client not available in AuthService; using in-memory token fallback');
      });
    } catch {
      this.logger.debug('Redis client creation failed in AuthService; using in-memory token fallback');
    }

    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (googleClientId && googleClientSecret) {
      this.googleClient = new OAuth2Client(
        googleClientId,
        googleClientSecret,
        this.getGoogleCallbackUrl(),
      );
      this.logger.log('Google OAuth client initialized');
    } else {
      this.logger.warn('Google OAuth is NOT configured (GOOGLE_CLIENT_ID/SECRET missing)');
    }
  }

  private async setSecurityToken(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch {
        // Fall back to in-memory store
      }
    }
    this.tokenStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  private async getSecurityToken(key: string): Promise<any | null> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const raw = await this.redis.get(key);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch {
        // Fall back to in-memory store
      }
    }

    const entry = this.tokenStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.tokenStore.delete(key);
      return null;
    }
    return entry.value;
  }

  private async deleteSecurityToken(key: string): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.del(key);
      } catch {
        // Fall back
      }
    }
    this.tokenStore.delete(key);
  }

  getGoogleCallbackUrl(): string {
    const configured = this.configService.get<string>('GOOGLE_CALLBACK_URL');
    if (configured) return configured;
    const appUrl =
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.configService.get<string>('FRONTEND_URL');
    if (appUrl) return `${appUrl.replace(/\/$/, '')}/api/v1/auth/google/callback`;
    if (process.env.VERCEL) return 'https://niva-iota.vercel.app/api/v1/auth/google/callback';
    return 'http://localhost:4000/api/v1/auth/google/callback';
  }

  isGoogleOAuthConfigured(): boolean {
    return !!this.googleClient;
  }

  toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      status: user.status as UserStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private generateTokens(user: User): {
    accessToken: string;
    refreshToken: string;
    refreshTokenHash: string;
    expiresInSeconds: number;
    expiresAt: Date;
  } {
    const expiresInSeconds = 900; // 15 minutes
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '15m' },
    );

    // Cryptographically random 40-byte refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // 30 days refresh lifetime
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
      expiresInSeconds,
      expiresAt,
    };
  }

  async register(input: RegisterInput, client: ClientContext): Promise<AuthResult> {
    const validated = RegisterSchema.parse(input);

    const existing = await this.userRepository.findByEmail(validated.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.hashPassword(validated.password);
    const newUser: NewUser = {
      email: validated.email,
      passwordHash,
      name: validated.name,
      isEmailVerified: false,
      status: 'active',
    };

    const user = await this.userRepository.create(newUser);

    // Automatically initialize user personalization record with preferredName matching name
    try {
      await this.db
        .insert(schema.userPersonalization)
        .values({
          userId: user.id,
          preferredName: user.name,
        })
        .onConflictDoNothing();
    } catch {
      // Non-blocking personalization init
    }

    const tokens = this.generateTokens(user);

    await this.sessionRepository.create({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      userAgent: client.userAgent || null,
      ipAddress: client.ipAddress || null,
      expiresAt: tokens.expiresAt,
    });

    this.logger.log(`User registered successfully: ${user.id}`);

    // Non-blocking initial verification email dispatch
    try {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await this.setSecurityToken(`email_verif:${verificationToken}`, { userId: user.id, email: user.email }, 86400);
      this.mailService
        .sendVerificationEmail(user.email, user.name || 'Friend', verificationToken)
        .catch((err) => {
          this.logger.warn(`Could not dispatch welcome verification email on registration: ${err.message}`);
        });
    } catch (err: any) {
      this.logger.warn(`Could not prepare initial verification email on registration: ${err.message}`);
    }

    return {
      user: this.toUserDto(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSeconds: tokens.expiresInSeconds,
    };
  }

  async login(input: LoginInput, client: ClientContext): Promise<AuthResult> {
    const validated = LoginSchema.parse(input);

    const user = await this.userRepository.findByEmail(validated.email);
    if (!user || !user.passwordHash) {
      // Uniform generic message prevents email enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await this.comparePassword(validated.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is suspended or deactivated');
    }

    const tokens = this.generateTokens(user);

    await this.sessionRepository.create({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      userAgent: client.userAgent || null,
      ipAddress: client.ipAddress || null,
      expiresAt: tokens.expiresAt,
    });

    this.logger.log(`User logged in: ${user.id}`);
    return {
      user: this.toUserDto(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSeconds: tokens.expiresInSeconds,
    };
  }

  async refresh(refreshToken: string, client: ClientContext): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.sessionRepository.findValidByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User account is invalid or no longer active');
    }

    // Token Rotation: revoke old session and issue a new pair
    await this.sessionRepository.revoke(session.id);

    const tokens = this.generateTokens(user);
    await this.sessionRepository.create({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      userAgent: client.userAgent || session.userAgent,
      ipAddress: client.ipAddress || session.ipAddress,
      expiresAt: tokens.expiresAt,
    });

    return {
      user: this.toUserDto(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSeconds: tokens.expiresInSeconds,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = await this.sessionRepository.findValidByTokenHash(tokenHash);
      if (session) {
        await this.sessionRepository.revoke(session.id);
      }
    }
  }

  async getCurrentUser(userId: string): Promise<UserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toUserDto(user);
  }

  async getGoogleAuthorizationUrl(): Promise<string> {
    if (!this.googleClient) {
      throw new ServiceUnavailableException('Google OAuth is not configured on this server');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');

    // Store state in Redis / security token store with 10 min TTL (600s) for CSRF protection
    await this.setSecurityToken(`oauth_state:${state}`, { nonce, createdAt: Date.now() }, 600);

    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  async handleGoogleCallback(
    code: string,
    state: string,
    client: ClientContext,
  ): Promise<AuthResult> {
    if (!state) {
      throw new BadRequestException('OAuth state parameter is missing');
    }

    // 1. Verify CSRF state token
    const stateData = await this.getSecurityToken(`oauth_state:${state}`);
    if (!stateData) {
      throw new BadRequestException('OAuth state is invalid or has expired (CSRF check failed)');
    }
    // Invalidate state token immediately to prevent replay attacks
    await this.deleteSecurityToken(`oauth_state:${state}`);

    if (!this.googleClient) {
      throw new ServiceUnavailableException('Google OAuth is not configured on this server');
    }

    try {
      const { tokens: oauthTokens } = await this.googleClient.getToken(code);
      if (!oauthTokens.id_token) {
        throw new BadRequestException('Failed to retrieve ID token from Google');
      }

      const expectedAudience = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const ticket = await this.googleClient.verifyIdToken({
        idToken: oauthTokens.id_token,
        audience: expectedAudience,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new BadRequestException('Invalid user profile from Google');
      }

      // Check issuer
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!payload.iss || !validIssuers.includes(payload.iss)) {
        throw new BadRequestException('Invalid ID token issuer');
      }

      // Check audience
      if (expectedAudience && payload.aud !== expectedAudience) {
        throw new BadRequestException('Invalid ID token audience');
      }

      // Check nonce if present in ID token
      if (stateData.nonce && payload.nonce && payload.nonce !== stateData.nonce) {
        throw new BadRequestException('OAuth nonce mismatch');
      }

      const googleSub = payload.sub;
      const email = payload.email.trim().toLowerCase();
      const name = payload.name || 'NIVA User';
      const avatarUrl = payload.picture || null;
      const isEmailVerified = payload.email_verified || false;

      // 1. Check if OAuth account already linked
      const existingOAuth = await this.oauthRepository.findByProvider('google', googleSub);
      let user: User | null = null;

      if (existingOAuth) {
        user = await this.userRepository.findById(existingOAuth.userId);
      } else {
        // 2. Check if user with this email already exists
        const existingUser = await this.userRepository.findByEmail(email);

        if (existingUser) {
          // Safe Account Linking Policy:
          // Google verified the email address
          if (!isEmailVerified) {
            throw new BadRequestException('Google email is unverified; cannot link account');
          }

          user = existingUser;
          // Link Google OAuth account to existing user
          await this.oauthRepository.create({
            userId: user.id,
            provider: 'google',
            providerUserId: googleSub,
            profileData: payload,
          });

          // Ensure email is marked verified if not already
          if (!user.isEmailVerified) {
            user = await this.userRepository.update(user.id, { isEmailVerified: true });
          }
        } else {
          // 3. Brand new user from Google
          user = await this.userRepository.create({
            email,
            passwordHash: null,
            name,
            avatarUrl,
            isEmailVerified: true,
            status: 'active',
          });

          await this.oauthRepository.create({
            userId: user.id,
            provider: 'google',
            providerUserId: googleSub,
            profileData: payload,
          });

          // Initialize user personalization record
          try {
            await this.db
              .insert(schema.userPersonalization)
              .values({
                userId: user.id,
                preferredName: user.name,
              })
              .onConflictDoNothing();
          } catch {
            // Non-blocking personalization init
          }
        }
      }

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('User account is invalid or suspended');
      }

      const sessionTokens = this.generateTokens(user);
      await this.sessionRepository.create({
        userId: user.id,
        tokenHash: sessionTokens.refreshTokenHash,
        userAgent: client.userAgent || null,
        ipAddress: client.ipAddress || null,
        expiresAt: sessionTokens.expiresAt,
      });

      return {
        user: this.toUserDto(user),
        accessToken: sessionTokens.accessToken,
        refreshToken: sessionTokens.refreshToken,
        expiresInSeconds: sessionTokens.expiresInSeconds,
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error('Google OAuth callback failed:', err);
      throw new BadRequestException('Google authentication failed');
    }
  }

  // ==========================================
  // ACCOUNT LIFECYCLE & SECURITY METHODS
  // ==========================================

  async requestEmailVerification(
    userId: string,
  ): Promise<{ success: boolean; message: string; verificationToken?: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        message: 'Email address is already verified.',
      };
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.setSecurityToken(`email_verif:${verificationToken}`, { userId: user.id, email: user.email }, 86400);

    // Send transactional verification email via MailService (Resend / SMTP / Dev fallback)
    await this.mailService.sendVerificationEmail(user.email, user.name || 'Friend', verificationToken);
    this.logger.log(`Email verification dispatched to user ${user.id}`);

    const isDev = this.configService.get<string>('NODE_ENV') !== 'production';
    const exposeTokensInDev = this.configService.get<string>('DEV_EXPOSE_AUTH_TOKENS', 'true') === 'true';

    return {
      success: true,
      message: 'Verification link sent to your email address.',
      verificationToken: isDev && exposeTokensInDev ? verificationToken : undefined,
    };
  }

  async confirmEmailVerification(token: string): Promise<{ success: boolean; user: UserDto }> {
    const data = await this.getSecurityToken(`email_verif:${token}`);
    if (!data || !data.userId) {
      throw new BadRequestException('Invalid or expired email verification token');
    }

    const updated = await this.userRepository.update(data.userId, { isEmailVerified: true });
    await this.deleteSecurityToken(`email_verif:${token}`);

    this.logger.log(`Email address verified for user ${data.userId}`);
    return {
      success: true,
      user: this.toUserDto(updated),
    };
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string; resetToken?: string }> {
    const user = await this.userRepository.findByEmail(email);
    const genericMsg = 'If an account exists with this email, password reset instructions have been sent.';

    if (!user) {
      return { success: true, message: genericMsg };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.setSecurityToken(`pwd_reset:${resetToken}`, { userId: user.id, email: user.email }, 3600);

    // Send transactional password reset email via MailService (Resend / SMTP / Dev fallback)
    await this.mailService.sendPasswordResetEmail(user.email, user.name || 'User', resetToken);
    this.logger.log(`Password reset instructions dispatched to user ${user.id}`);

    const isDev = this.configService.get<string>('NODE_ENV') !== 'production';
    const exposeTokensInDev = this.configService.get<string>('DEV_EXPOSE_AUTH_TOKENS', 'true') === 'true';

    return {
      success: true,
      message: genericMsg,
      resetToken: isDev && exposeTokensInDev ? resetToken : undefined,
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const data = await this.getSecurityToken(`pwd_reset:${token}`);
    if (!data || !data.userId) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new BadRequestException('User account not found');
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await this.userRepository.update(user.id, { passwordHash: newPasswordHash });

    // Revoke all active sessions
    await this.sessionRepository.revokeAllForUser(user.id);
    await this.deleteSecurityToken(`pwd_reset:${token}`);

    this.logger.log(`Password reset completed for user ${user.id}`);
    return {
      success: true,
      message: 'Password has been successfully reset. Please log in with your new password.',
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordHash) {
      const isMatch = await this.comparePassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new BadRequestException('Current password does not match');
      }
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await this.userRepository.update(userId, { passwordHash: newPasswordHash });

    // Revoke all active sessions across all devices for security
    await this.sessionRepository.revokeAllForUser(userId);

    // Send security notification email
    this.mailService
      .sendSecurityAlertEmail(
        user.email,
        user.name || 'User',
        'Password Changed',
        'Your NIVA account password was successfully updated. All active sessions have been logged out for security.',
      )
      .catch(() => {});

    this.logger.log(`Password changed by user ${userId}; active sessions revoked`);
    return {
      success: true,
      message: 'Password changed successfully. All sessions have been logged out for security.',
    };
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepository.revokeAllForUser(userId);
    this.logger.log(`All sessions revoked for user ${userId}`);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const effectiveName = dto.name !== undefined ? dto.name.trim() : dto.preferredName !== undefined ? dto.preferredName.trim() : undefined;

    const updatePayload: Partial<NewUser> = {};
    if (effectiveName !== undefined) updatePayload.name = effectiveName;
    if (dto.avatarUrl !== undefined) updatePayload.avatarUrl = dto.avatarUrl.trim();

    const updated = await this.userRepository.update(userId, updatePayload);

    // Synchronize preferred_name in user_personalization table
    if (effectiveName !== undefined) {
      try {
        await this.db
          .insert(schema.userPersonalization)
          .values({
            userId,
            preferredName: effectiveName,
          })
          .onConflictDoUpdate({
            target: schema.userPersonalization.userId,
            set: { preferredName: effectiveName, updatedAt: new Date() },
          });
      } catch (err: any) {
        this.logger.debug(`Could not sync preferredName in userPersonalization: ${err.message}`);
      }
    }

    return this.toUserDto(updated);
  }

  async exportUserData(userId: string): Promise<Record<string, any>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Query user personalization & profiles
    const [personalization] = await this.db
      .select()
      .from(schema.userPersonalization)
      .where(eq(schema.userPersonalization.userId, userId));
    const [profile] = await this.db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, userId));

    // Query life context
    const goals = await this.db.select().from(schema.lifeGoals).where(eq(schema.lifeGoals.userId, userId));
    const projects = await this.db.select().from(schema.lifeProjects).where(eq(schema.lifeProjects.userId, userId));
    const tasks = await this.db.select().from(schema.lifeTasks).where(eq(schema.lifeTasks.userId, userId));
    const commitments = await this.db.select().from(schema.lifeCommitments).where(eq(schema.lifeCommitments.userId, userId));
    const ideas = await this.db.select().from(schema.lifeIdeas).where(eq(schema.lifeIdeas.userId, userId));

    // Query memories
    const memories = await this.db.select().from(schema.memories).where(eq(schema.memories.userId, userId));

    // Query conversations metadata
    const conversations = await this.db.select().from(schema.conversations).where(eq(schema.conversations.userId, userId));

    // Query notifications
    const notifications = await this.db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));

    // Query scheduled jobs
    const jobs = await this.db.select().from(schema.scheduledJobs).where(eq(schema.scheduledJobs.userId, userId));

    return {
      exportedAt: new Date().toISOString(),
      formatVersion: '1.0',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      personalization: personalization || null,
      profile: profile || null,
      lifeContext: {
        goals,
        projects,
        tasks,
        commitments,
        ideas,
      },
      memories: memories.map((m) => ({
        id: m.id,
        content: m.content,
        category: m.category,
        confidence: m.confidence,
        importance: m.importance,
        createdAt: m.createdAt.toISOString(),
      })),
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        characterId: c.characterId,
        createdAt: c.createdAt.toISOString(),
      })),
      scheduledReminders: jobs.map((j) => ({
        id: j.id,
        jobType: j.jobType,
        targetType: j.targetType,
        targetId: j.targetId,
        scheduledAt: j.scheduledAt.toISOString(),
        status: j.status,
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        channel: n.channel,
        read: n.read,
        deliveryStatus: n.deliveryStatus,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async deleteAccount(
    userId: string,
    confirmText: string,
    password?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (confirmText !== 'DELETE') {
      throw new BadRequestException('Confirmation keyword must be exactly "DELETE"');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // If account has a password set, verify it
    if (user.passwordHash) {
      if (!password) {
        throw new BadRequestException('Current password is required to confirm account deletion');
      }
      const isMatch = await this.comparePassword(password, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedException('Incorrect password');
      }
    }

    // Revoke all active sessions
    await this.sessionRepository.revokeAllForUser(userId);

    // Send security notification email
    this.mailService
      .sendSecurityAlertEmail(
        user.email,
        user.name || 'User',
        'Account Deleted',
        'Your NIVA account and all associated personal data have been permanently deleted from our servers.',
      )
      .catch(() => {});

    // Delete user from database (PostgreSQL CASCADE automatically deletes all 38 related tables)
    await this.userRepository.delete(userId);

    this.logger.log(`Account deleted permanently: ${userId}`);
    return {
      success: true,
      message: 'Account and all associated personal data have been permanently deleted.',
    };
  }

  getCapturedEmails() {
    return this.mailService.getCapturedEmails();
  }

  clearCapturedEmails() {
    this.mailService.clearCapturedEmails();
  }

  async getEmailStatus() {
    return this.mailService.getStatus();
  }

  async verifySmtpConnection() {
    return this.mailService.verifySmtpConnection();
  }
}
