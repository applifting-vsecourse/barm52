import { Mood, MOODS } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreatePollDto } from './create-poll.dto';

export class CreateQuackDto {
  @ApiProperty({
    description: 'Body of the quack',
    example: 'Hello, world!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiPropertyOptional({
    description: 'How the author feels. Leave it out, or send null, for none.',
    enum: [...MOODS],
    enumName: 'Mood',
    nullable: true,
    example: 'happy',
  })
  // @IsOptional skips validation for both undefined and null.
  @IsOptional()
  @IsIn(MOODS)
  mood?: Mood | null;

  @ApiPropertyOptional({
    description:
      'A poll to attach; the quack text is its question. Leave it out, or send null, for none.',
    type: CreatePollDto,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto | null;
}
