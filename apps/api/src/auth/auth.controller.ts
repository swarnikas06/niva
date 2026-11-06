import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import {
  ConfirmEmailVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
  DeleteAccountDto,
} from './dto/account-lifecycle.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedPrincipal, UserDto } from '@niva/shared-types';
import { ConfigService } from '@nestjs/config';

const REFRESH_COOKIE_NAME = 'niva_refresh_token';
const ACCESS_COOKIE_NAME = 'niva_access_token';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    // Refresh token cookie (HttpOnly, 30 days)
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Short-lived Access Token cookie (15 mins) for browser fetch requests
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
    res.clearCookie(ACCESS_COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const client = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const result = await this.authService.register(dto, client);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: result.expiresInSeconds,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'User successfully authenticated' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const client = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const result = await this.authService.login(dto, client);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: result.expiresInSeconds,
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenFromCookie = req.cookies ? req.cookies[REFRESH_COOKIE_NAME] : undefined;
    const token = dto.refreshToken || tokenFromCookie;

    if (!token) {
      throw new BadRequestException('Refresh token is required');
    }

    const client = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const result = await this.authService.refresh(token, client);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: result.expiresInSeconds,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out current session and invalidate refresh token' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenFromCookie = req.cookies ? req.cookies[REFRESH_COOKIE_NAME] : undefined;
    const token = dto.refreshToken || tokenFromCookie;

    await this.authService.logout(token);
    this.clearAuthCookies(res);

    return {
      loggedOut: true,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async me(@CurrentUser() principal: AuthenticatedPrincipal): Promise<{ user: UserDto }> {
    const user = await this.authService.getCurrentUser(principal.userId);
    return { user };
  }

  private getWebUrl(): string {
    const configured =
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.configService.get<string>('FRONTEND_URL');
    if (configured) return configured.replace(/\/$/, '');
    if (process.env.VERCEL) return 'https://niva-iota.vercel.app';
    return 'http://localhost:3000';
  }

  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  async googleLogin(@Res() res: Response) {
    const webUrl = this.getWebUrl();
    try {
      const url = await this.authService.getGoogleAuthorizationUrl();
      return res.redirect(url);
    } catch {
      return res.redirect(`${webUrl}/login?error=oauth_unconfigured`);
    }
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback redirect' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const webUrl = this.getWebUrl();

    if (error || !code) {
      return res.redirect(`${webUrl}/login?error=oauth_denied`);
    }

    if (!state) {
      return res.redirect(`${webUrl}/login?error=oauth_invalid_state`);
    }

    try {
      const client = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.authService.handleGoogleCallback(code, state, client);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);

      return res.redirect(`${webUrl}/?auth=success`);
    } catch (err: any) {
      if (
        err?.message?.includes('state') ||
        err?.message?.includes('CSRF') ||
        err?.message?.includes('nonce')
      ) {
        return res.redirect(`${webUrl}/login?error=oauth_invalid_state`);
      }
      if (
        err?.message?.includes('not configured') ||
        err instanceof ServiceUnavailableException
      ) {
        return res.redirect(`${webUrl}/login?error=oauth_unconfigured`);
      }
      return res.redirect(`${webUrl}/login?error=oauth_failed`);
    }
  }

  // ==========================================
  // ACCOUNT LIFECYCLE & SECURITY ENDPOINTS
  // ==========================================

  @Post('verify-email/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request verification token for current authenticated user' })
  async requestEmailVerification(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.authService.requestEmailVerification(principal.userId);
  }

  @Post('verify-email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email verification using token' })
  async confirmEmailVerification(@Body() dto: ConfirmEmailVerificationDto) {
    return this.authService.confirmEmailVerification(dto.token);
  }

  @Post('forgot-password')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset instructions' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using security token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  private ensureDevDiagnosticAllowed() {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const isCaptureAllowed = this.configService.get<string>('ENABLE_LOCAL_EMAIL_CAPTURE', 'true') === 'true';
    if (isProd && !isCaptureAllowed) {
      throw new ForbiddenException('Development email diagnostic endpoints are disabled in production');
    }
  }

  @Get('dev/captured-emails')
  @ApiOperation({ summary: 'Inspect locally captured development emails (Zero-Cost local testing only)' })
  async getCapturedEmails() {
    this.ensureDevDiagnosticAllowed();
    const emails = this.authService.getCapturedEmails();
    return {
      success: true,
      capturedCount: emails.length,
      emails,
      notice:
        'Local email capture is for testing and validation only. It does not represent delivery to an actual user inbox.',
    };
  }

  @Delete('dev/captured-emails')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear locally captured development emails' })
  async clearCapturedEmails() {
    this.ensureDevDiagnosticAllowed();
    this.authService.clearCapturedEmails();
    return { success: true, cleared: true };
  }

  @Get('dev/email-status')
  @ApiOperation({ summary: 'Inspect email provider configuration and SMTP status' })
  async getEmailStatus() {
    this.ensureDevDiagnosticAllowed();
    return {
      success: true,
      data: await this.authService.getEmailStatus(),
    };
  }

  @Post('dev/verify-smtp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger active verification of SMTP server connection' })
  async verifySmtpConnection() {
    this.ensureDevDiagnosticAllowed();
    const result = await this.authService.verifySmtpConnection();
    return {
      success: true,
      data: result,
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for current authenticated user' })
  async changePassword(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      principal.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out and invalidate all sessions for current user' })
  async logoutAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(principal.userId);
    this.clearAuthCookies(res);
    return {
      loggedOut: true,
      allSessionsRevoked: true,
    };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile (name, avatar)' })
  async updateProfile(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.authService.updateProfile(principal.userId, dto);
    return { user: updated };
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export complete GDPR/privacy user personal data archive' })
  async exportUserData(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.authService.exportUserData(principal.userId);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete user account and all personal data' })
  async deleteAccount(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.deleteAccount(
      principal.userId,
      dto.confirmText,
      dto.password,
    );
    this.clearAuthCookies(res);
    return result;
  }
}
