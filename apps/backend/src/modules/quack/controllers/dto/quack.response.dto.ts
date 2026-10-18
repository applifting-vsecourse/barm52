import { toPollView } from '@/modules/quack/domain/poll';
import { Mood, MOODS, Quack } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { PollResponseDto } from './poll.response.dto';

class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ enum: [...MOODS], enumName: 'Mood', nullable: true })
  mood!: Mood | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: QuackUserDto })
  user!: QuackUserDto;

  @ApiProperty({
    type: PollResponseDto,
    nullable: true,
    description: 'Null for a quack without a poll',
  })
  poll!: PollResponseDto | null;

  // A poll looks different to each reader, so the reader and the moment of
  // reading come along. Without a reader there is nothing to hide from.
  static fromDomain(
    quack: Quack,
    viewerId = '',
    now = new Date(),
  ): QuackResponseDto {
    if (!quack.user) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    return {
      id: quack.id,
      text: quack.text,
      mood: quack.mood,
      userId: quack.userId,
      createdAt: quack.createdAt,
      user: {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username,
      },
      poll: quack.poll
        ? PollResponseDto.fromDomain(toPollView(quack.poll, viewerId, now))
        : null,
    };
  }
}
