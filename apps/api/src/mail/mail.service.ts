import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface CapturedEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  capturedAt: string;
  provider: 'local_capture' | 'smtp' | 'resend';
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;
  private readonly resendApiKey: string | null;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;
  private readonly isProduction: boolean;
  private static readonly capturedEmailsBuffer: CapturedEmail[] = [];
  private smtpVerified = false;
  private smtpLastError: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY', '').trim() || null;
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL', '').trim() ||
      this.configService.get<string>('NEXT_PUBLIC_APP_URL', '').trim() ||
      'http://localhost:3000';
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    const smtpHost = this.configService.get<string>('SMTP_HOST', '').trim();
    const smtpUser = this.configService.get<string>('SMTP_USER', '').trim();
    const configuredFrom = this.configService.get<string>('EMAIL_FROM', '').trim();

    if (configuredFrom) {
      this.fromAddress = configuredFrom;
    } else if (smtpUser) {
      this.fromAddress = `NIVA Companion <${smtpUser}>`;
    } else {
      this.fromAddress = 'NIVA Companion <onboarding@resend.dev>';
    }

    if (smtpHost) {
      const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
      const pass = (
        this.configService.get<string>('SMTP_PASSWORD') ||
        this.configService.get<string>('SMTP_PASS', '')
      ).trim();

      const secureConfig = this.configService.get<string>('SMTP_SECURE');
      const secure =
        secureConfig !== undefined && secureConfig !== ''
          ? secureConfig === 'true' || secureConfig === '1'
          : port === 465;

      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: smtpUser ? { user: smtpUser, pass } : undefined,
        connectionTimeout: 10000, // 10s connection timeout
        greetingTimeout: 10000,   // 10s greeting timeout
        socketTimeout: 15000,     // 15s socket timeout
      });

      this.logger.log(
        `SMTP transporter configured for ${smtpHost}:${port} (secure=${secure}, user=${smtpUser ? this.maskEmail(smtpUser) : 'none'})`,
      );

      // Non-blocking connection verification on startup
      this.smtpTransporter
        .verify()
        .then(() => {
          this.smtpVerified = true;
          this.smtpLastError = null;
          this.logger.log(`[SMTP] Connection established and verified successfully with ${smtpHost}:${port}`);
        })
        .catch((err) => {
          this.smtpVerified = false;
          this.smtpLastError = this.formatSmtpError(err);
          this.logger.warn(`[SMTP] Verification failed for ${smtpHost}:${port} - ${this.smtpLastError}`);
        });
    }

    if (this.resendApiKey) {
      this.logger.log('Resend transactional email provider active');
    }
  }

  /**
   * Helper to format and classify SMTP errors with clear actionable messages.
   * NEVER logs or reveals passwords.
   */
  private formatSmtpError(err: any): string {
    if (!err) return 'Unknown error';
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      return 'Authentication failed (535). If using Gmail, ensure 2-Step Verification is active and a 16-character App Password (not your normal Google account password) is used in SMTP_PASSWORD.';
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
      return `Connection timed out (${err.code}). Please verify SMTP_HOST and SMTP_PORT connectivity.`;
    }
    if (err.code === 'ECONNREFUSED') {
      return `Connection refused (${err.address || 'host'}:${err.port || ''}). Verify port and network/firewall settings.`;
    }
    if (err.responseCode === 550 || err.code === 'EENVELOPE') {
      return `Mailbox unavailable or invalid recipient address (${err.message || 550}).`;
    }
    return err.message || String(err);
  }

  private allowLocalCapture(): boolean {
    return (
      this.configService.get<string>('ENABLE_LOCAL_EMAIL_CAPTURE', 'true') === 'true' ||
      !this.isProduction
    );
  }

  private recordCapturedEmail(options: SendEmailOptions, provider: 'local_capture' | 'smtp' | 'resend') {
    if (this.allowLocalCapture()) {
      const captured: CapturedEmail = {
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        capturedAt: new Date().toISOString(),
        provider,
      };
      MailService.capturedEmailsBuffer.unshift(captured);
      if (MailService.capturedEmailsBuffer.length > 50) {
        MailService.capturedEmailsBuffer.pop();
      }
    }
  }

  /**
   * Dispatches an outbound email through Resend API, SMTP, or development fallback.
   */
  async sendEmail(options: SendEmailOptions): Promise<{ delivered: boolean; messageId?: string; provider: string }> {
    const { to, subject, html, text } = options;

    const emailProviderPref = this.configService.get<string>('EMAIL_PROVIDER', '').trim().toLowerCase();
    const preferSmtp = emailProviderPref === 'smtp' || (!this.resendApiKey && Boolean(this.smtpTransporter));

    // 1. If SMTP is preferred and configured, try SMTP first
    if (preferSmtp && this.smtpTransporter) {
      try {
        const info = await this.smtpTransporter.sendMail({
          from: this.fromAddress,
          to,
          subject,
          html,
          text,
        });
        this.logger.log(`Email dispatched via SMTP: ${info.messageId} to ${this.maskEmail(to)}`);
        this.recordCapturedEmail(options, 'smtp');
        return { delivered: true, messageId: info.messageId, provider: 'smtp' };
      } catch (err: any) {
        const classifiedError = this.formatSmtpError(err);
        this.logger.error(`SMTP dispatch error to ${this.maskEmail(to)}: ${classifiedError}`);
        // If Resend is available as fallback, don't throw yet
        if (!this.resendApiKey && this.isProduction && !this.allowLocalCapture()) {
          throw new BadGatewayException(`SMTP email delivery failed: ${classifiedError}`);
        }
      }
    }

    // 2. Try Resend API if API Key is configured
    if (this.resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromAddress,
            to: [to],
            subject,
            html,
            text,
          }),
        });

        const data = (await response.json()) as any;
        if (!response.ok) {
          const errDetail = data?.message || response.statusText;
          this.logger.error(`Resend API dispatch rejected: ${errDetail}`);
          if (this.isProduction && !this.smtpTransporter && !this.allowLocalCapture()) {
            throw new BadGatewayException(`Outbound email rejected by provider: ${errDetail}`);
          }
        } else {
          this.logger.log(`Email dispatched via Resend: ${data?.id} to ${this.maskEmail(to)}`);
          this.recordCapturedEmail(options, 'resend');
          return { delivered: true, messageId: data?.id, provider: 'resend' };
        }
      } catch (err: any) {
        this.logger.error(`Resend dispatch error: ${err.message}`);
        if (this.isProduction && !this.smtpTransporter && !this.allowLocalCapture()) {
          throw new BadGatewayException(`Email delivery service failed: ${err.message}`);
        }
      }
    }

    // 3. Try SMTP Transporter if not already tried
    if (!preferSmtp && this.smtpTransporter) {
      try {
        const info = await this.smtpTransporter.sendMail({
          from: this.fromAddress,
          to,
          subject,
          html,
          text,
        });
        this.logger.log(`Email dispatched via SMTP: ${info.messageId} to ${this.maskEmail(to)}`);
        this.recordCapturedEmail(options, 'smtp');
        return { delivered: true, messageId: info.messageId, provider: 'smtp' };
      } catch (err: any) {
        const classifiedError = this.formatSmtpError(err);
        this.logger.error(`SMTP dispatch error: ${classifiedError}`);
        if (this.isProduction && !this.allowLocalCapture()) {
          throw new BadGatewayException(`SMTP email delivery failed: ${classifiedError}`);
        }
      }
    }

    // 4. Local Email Capture Fallback (Zero-Cost Local Development / Testing)
    if (this.allowLocalCapture()) {
      this.recordCapturedEmail(options, 'local_capture');
      this.logger.log(
        `[LocalEmailCapture] (ZERO-COST DEV/TEST) Outgoing email captured: To=${this.maskEmail(to)}, Subject="${subject}". NOTE: Local email capture is NOT delivery to an actual user inbox.`,
      );
      if (text) {
        this.logger.debug(`[LocalEmailCapture] Body: ${text}`);
      }
      return { delivered: true, messageId: `captured-${Date.now()}`, provider: 'local_capture' };
    }

    // In production without email provider configured, reject request
    throw new BadGatewayException('Outbound transactional email service is not configured on this server');
  }

  /**
   * Returns current email provider readiness and status without exposing credentials.
   */
  async getStatus(): Promise<{
    activeProvider: 'resend' | 'smtp' | 'local_capture';
    resendConfigured: boolean;
    smtpConfigured: boolean;
    smtpVerified: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUserMasked?: string;
    smtpError?: string;
    fromAddress: string;
    localCaptureEnabled: boolean;
    capturedCount: number;
  }> {
    const smtpHost = this.configService.get<string>('SMTP_HOST', '').trim();
    const smtpUser = this.configService.get<string>('SMTP_USER', '').trim();
    const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);

    let activeProvider: 'resend' | 'smtp' | 'local_capture' = 'local_capture';
    if (this.resendApiKey) {
      activeProvider = 'resend';
    } else if (this.smtpTransporter) {
      activeProvider = 'smtp';
    }

    return {
      activeProvider,
      resendConfigured: Boolean(this.resendApiKey),
      smtpConfigured: Boolean(this.smtpTransporter),
      smtpVerified: this.smtpVerified,
      smtpHost: smtpHost || undefined,
      smtpPort: smtpHost ? port : undefined,
      smtpUserMasked: smtpUser ? this.maskEmail(smtpUser) : undefined,
      smtpError: this.smtpLastError || undefined,
      fromAddress: this.fromAddress,
      localCaptureEnabled: this.allowLocalCapture(),
      capturedCount: MailService.capturedEmailsBuffer.length,
    };
  }

  /**
   * Explicitly triggers an SMTP server verification handshake.
   */
  async verifySmtpConnection(): Promise<{
    configured: boolean;
    verified: boolean;
    host?: string;
    port?: number;
    error?: string;
  }> {
    const smtpHost = this.configService.get<string>('SMTP_HOST', '').trim();
    if (!this.smtpTransporter || !smtpHost) {
      return { configured: false, verified: false, error: 'SMTP is not configured on this server' };
    }
    const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
    try {
      await this.smtpTransporter.verify();
      this.smtpVerified = true;
      this.smtpLastError = null;
      return { configured: true, verified: true, host: smtpHost, port };
    } catch (err: any) {
      this.smtpVerified = false;
      this.smtpLastError = this.formatSmtpError(err);
      return {
        configured: true,
        verified: false,
        host: smtpHost,
        port,
        error: this.smtpLastError,
      };
    }
  }

  /**
   * Retrieves the in-memory buffer of locally captured emails (for test verification & dev workflow).
   */
  getCapturedEmails(): CapturedEmail[] {
    return [...MailService.capturedEmailsBuffer];
  }

  /**
   * Clears the in-memory buffer of locally captured emails.
   */
  clearCapturedEmails(): void {
    MailService.capturedEmailsBuffer.length = 0;
  }

  /**
   * Sends an account email verification email.
   */
  async sendVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
    const verificationUrl = `${this.frontendUrl}/login?verified=pending&token=${token}`;
    const subject = 'Verify your email for NIVA';
    const html = this.renderEmailLayout({
      title: 'Email Verification',
      heading: 'Verify your email address',
      recipientName: name || 'Friend',
      bodyText:
        'Thank you for signing up for NIVA, your persistent personal AI companion. Please confirm your email address to enable proactive reminders and secure account recovery.',
      ctaUrl: verificationUrl,
      ctaLabel: 'Verify Email Address',
      secondaryText: `This verification link expires in 24 hours. If the button above does not work, copy and paste this link into your browser: <br/><a href="${verificationUrl}" style="color: #10b981; word-break: break-all;">${verificationUrl}</a>`,
      footerNote: 'If you did not create an account with NIVA, you can safely ignore this email.',
    });

    const result = await this.sendEmail({
      to,
      subject,
      html,
      text: `Welcome to NIVA, ${name}. Verify your email: ${verificationUrl}`,
    });

    return result.delivered;
  }

  /**
   * Sends a password reset email.
   */
  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const subject = 'Reset your NIVA password';
    const html = this.renderEmailLayout({
      title: 'Password Reset',
      heading: 'Reset your password',
      recipientName: name || 'User',
      bodyText:
        'We received a request to reset your password for your NIVA account. Click the button below to choose a new password.',
      ctaUrl: resetUrl,
      ctaLabel: 'Reset Password',
      secondaryText: `This link expires in 1 hour for security. If the button above does not work, copy and paste this link into your browser: <br/><a href="${resetUrl}" style="color: #10b981; word-break: break-all;">${resetUrl}</a>`,
      footerNote:
        'If you did not request a password reset, please change your password immediately or contact your administrator.',
    });

    const result = await this.sendEmail({
      to,
      subject,
      html,
      text: `Hello ${name}. Reset your password: ${resetUrl} (expires in 1 hour)`,
    });

    return result.delivered;
  }

  /**
   * Sends an account security alert email (e.g. password changed, all sessions revoked).
   */
  async sendSecurityAlertEmail(to: string, name: string, actionTitle: string, details: string): Promise<boolean> {
    const subject = `Security Alert: ${actionTitle}`;
    const settingsUrl = `${this.frontendUrl}/settings`;
    const html = this.renderEmailLayout({
      title: 'Security Notice',
      heading: actionTitle,
      recipientName: name || 'User',
      bodyText: `This is an automated notification regarding your NIVA account: ${details}`,
      ctaUrl: settingsUrl,
      ctaLabel: 'Review Account Settings',
      secondaryText: `Timestamp: ${new Date().toUTCString()}`,
      footerNote: 'If you did not authorize this action, please secure your account immediately.',
    });

    const result = await this.sendEmail({
      to,
      subject,
      html,
      text: `Security Alert for ${name}: ${actionTitle}. Details: ${details}`,
    });

    return result.delivered;
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0]!;
    const domain = parts[1]!;
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${maskedName}@${domain}`;
  }

  /**
   * Generates a branded Flashform-styled dark HTML email.
   */
  private renderEmailLayout(params: {
    title: string;
    heading: string;
    recipientName: string;
    bodyText: string;
    ctaUrl: string;
    ctaLabel: string;
    secondaryText: string;
    footerNote: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title} — NIVA</title>
  <style>
    body { margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; }
    .container { max-width: 580px; margin: 40px auto; padding: 0 20px; }
    .card { background-color: #121215; border: 1px solid #27272a; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: #10b981; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 20px; }
    .logo { font-size: 18px; font-weight: 900; letter-spacing: -0.03em; color: #ffffff; text-transform: uppercase; margin-bottom: 28px; }
    .logo span { color: #10b981; }
    h1 { font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; letter-spacing: -0.02em; }
    p { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 20px 0; }
    .cta-container { margin: 32px 0; text-align: left; }
    .btn { display: inline-block; background-color: #10b981; color: #09090b !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
    .secondary { font-size: 12px; color: #71717a; line-height: 1.5; border-top: 1px solid #27272a; padding-top: 20px; margin-top: 24px; }
    .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #52525b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">NIVA <span>®</span></div>
      <div class="badge">${params.title}</div>
      <h1>${params.heading}</h1>
      <p>Hello ${params.recipientName},</p>
      <p>${params.bodyText}</p>
      <div class="cta-container">
        <a href="${params.ctaUrl}" class="btn" target="_blank">${params.ctaLabel}</a>
      </div>
      <div class="secondary">
        ${params.secondaryText}
      </div>
    </div>
    <div class="footer">
      ${params.footerNote}<br/>
      NIVA — Persistent Personal AI Companion © 2026. All rights reserved.
    </div>
  </div>
</body>
</html>`;
  }
}
