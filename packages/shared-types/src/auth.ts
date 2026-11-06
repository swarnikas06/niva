/**
 * NIVA Authentication & Identity Shared Types
 */

export type UserStatus = 'active' | 'suspended' | 'deactivated';

export type OAuthProvider = 'google';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface AuthResponseData {
  user: UserDto;
  tokens: AuthTokensDto;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface RefreshTokenRequestDto {
  refreshToken?: string;
}

export interface SessionDto {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
}
