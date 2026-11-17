import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// A reply is text only: no mood and no poll. The quack it answers comes from
// the URL, the author from the session.
export class CreateReplyDto {
  @ApiProperty({
    description: 'Body of the reply',
    example: 'Totally agree!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;
}
