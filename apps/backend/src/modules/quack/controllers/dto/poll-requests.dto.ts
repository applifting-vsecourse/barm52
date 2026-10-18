import { MAX_POLL_OPTION_LENGTH } from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class VoteDto {
  @ApiProperty({ description: 'The published answer to vote for' })
  @IsString()
  @IsNotEmpty()
  optionId!: string;
}

export class SuggestOptionDto {
  @ApiProperty({
    description: `The new answer, 1 to ${MAX_POLL_OPTION_LENGTH} characters after trimming`,
    maxLength: MAX_POLL_OPTION_LENGTH,
    example: 'Tacos',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Write an answer first' })
  @MaxLength(MAX_POLL_OPTION_LENGTH)
  text!: string;
}
