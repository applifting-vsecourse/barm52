import { Mood, MOODS } from '@/modules/quack/domain/quack';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  USERNAME_PATTERN,
} from '@/modules/settings/domain/settings';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// The whole settings form, sent on every save.
export class UpdateSettingsDto {
  @ApiProperty({
    description: `${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} letters, numbers, underscores or dots. Unique, ignoring case.`,
    example: 'CaffeinatedDuck',
    minLength: MIN_USERNAME_LENGTH,
    maxLength: MAX_USERNAME_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @Length(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH, {
    message: `Username must be ${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} characters`,
  })
  @Matches(USERNAME_PATTERN, {
    message: 'Use only letters, numbers, underscores and dots',
  })
  username!: string;

  @ApiProperty({
    description: 'Shown on every quack and in the header',
    example: 'Caffeinated Duck',
    maxLength: MAX_DISPLAY_NAME_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Display name is required' })
  @MaxLength(MAX_DISPLAY_NAME_LENGTH, {
    message: `Keep it under ${MAX_DISPLAY_NAME_LENGTH} characters`,
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'Leave it out, send null or an empty string for none',
    example: 'Runs on espresso.',
    maxLength: MAX_BIO_LENGTH,
    nullable: true,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BIO_LENGTH, {
    message: `Keep it under ${MAX_BIO_LENGTH} characters`,
  })
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'Preselected in the new-quack form. Null for no mood.',
    enum: [...MOODS],
    enumName: 'Mood',
    nullable: true,
  })
  @IsOptional()
  @IsIn(MOODS)
  defaultMood?: Mood | null;
}
