import { Mood, MOODS } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
}
