import { LikeSummary } from '@/modules/quack/domain/like';
import { ApiProperty } from '@nestjs/swagger';

export class LikeSummaryDto implements LikeSummary {
  @ApiProperty({ type: 'integer', minimum: 0 })
  count!: number;

  @ApiProperty({ description: 'Whether the signed-in viewer liked this quack' })
  likedByMe!: boolean;
}
