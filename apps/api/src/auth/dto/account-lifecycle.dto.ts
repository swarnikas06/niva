import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsIn,
} from 'class-validator';

export class RequestEmailVerificationDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'Target email to verify' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsOptional()
  email?: string;
}

export class ConfirmEmailVerificationDto {
  @ApiProperty({ example: 'a1b2c3d4e5...', description: 'Verification token sent to user' })
  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  token!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Registered user email address' })
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4e5...', description: 'Password reset token' })
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  token!: string;

  @ApiProperty({ example: 'NewStrongP@ssw0rd1', description: 'New password (min 8 chars, 1 letter, 1 number)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentP@ssw0rd1', description: 'Current user password' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @ApiProperty({ example: 'BrandNewP@ssw0rd1', description: 'New password (min 8 chars, 1 letter, 1 number)' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Alex Mercer', description: 'Full display name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Alex', description: 'Preferred name for companion dialogues' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  preferredName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/alex.jpg', description: 'Avatar image URL' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  avatarUrl?: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'DELETE', description: 'Explicit confirmation keyword (must be "DELETE")' })
  @IsString()
  @IsNotEmpty({ message: 'Confirmation keyword is required' })
  @IsIn(['DELETE'], { message: 'Confirmation keyword must be exactly "DELETE"' })
  confirmText!: string;

  @ApiPropertyOptional({ example: 'CurrentP@ssw0rd1', description: 'Current password for verification if account has password' })
  @IsString()
  @IsOptional()
  password?: string;
}
