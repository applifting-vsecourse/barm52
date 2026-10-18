import {
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  normalizePollOption,
  POLL_LENGTHS,
  POLL_RESULTS_VISIBILITIES,
  POLL_SUGGESTION_MODES,
  PollLength,
  PollResultsVisibility,
  PollSuggestionMode,
} from '@/modules/quack/domain/poll';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Answers are compared and stored trimmed.
const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

export class CreatePollDto {
  @ApiProperty({
    description: `The answers to choose from, in the order to show them. ${MIN_POLL_OPTIONS} to ${MAX_POLL_OPTIONS}, each 1 to ${MAX_POLL_OPTION_LENGTH} characters after trimming, no two the same ignoring case.`,
    type: [String],
    minItems: MIN_POLL_OPTIONS,
    maxItems: MAX_POLL_OPTIONS,
    example: ['Pizza', 'Sushi'],
  })
  @Transform(trimEach)
  @IsArray()
  @ArrayMinSize(MIN_POLL_OPTIONS)
  @ArrayMaxSize(MAX_POLL_OPTIONS)
  @IsString({ each: true })
  @MinLength(1, { each: true, message: 'Fill in or remove this option' })
  @MaxLength(MAX_POLL_OPTION_LENGTH, { each: true })
  @ArrayUnique(
    (option: unknown) =>
      typeof option === 'string' ? normalizePollOption(option) : option,
    { message: 'Answers must be different' },
  )
  options!: string[];

  @ApiPropertyOptional({
    description: 'How long the poll stays open. Left out, it never ends.',
    enum: [...POLL_LENGTHS],
    example: '1d',
  })
  @IsOptional()
  @IsIn(POLL_LENGTHS)
  length?: PollLength;

  @ApiPropertyOptional({
    description:
      'Who sees the numbers before the poll ends. Left out, everybody does.',
    enum: [...POLL_RESULTS_VISIBILITIES],
    example: 'immediately',
  })
  @IsOptional()
  @IsIn(POLL_RESULTS_VISIBILITIES)
  results?: PollResultsVisibility;

  @ApiPropertyOptional({
    description:
      'Whether others may add answers, and whether the author approves them first. Left out, nobody may.',
    enum: [...POLL_SUGGESTION_MODES],
    example: 'not_allowed',
  })
  @IsOptional()
  @IsIn(POLL_SUGGESTION_MODES)
  suggestions?: PollSuggestionMode;
}
