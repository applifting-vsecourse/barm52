import {
  POLL_RESULTS_VISIBILITIES,
  POLL_SUGGESTION_MODES,
  PollResultsVisibility,
  PollSuggestionMode,
  PollView,
} from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';

class PollOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Null while the reader may not see results',
  })
  votes!: number | null;
}

class PendingSuggestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;
}

// A poll as the signed-in user may see it. Votes are anonymous: only the
// reader's own choice is ever included.
export class PollResponseDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Null for a poll that never ends',
  })
  endsAt!: Date | null;

  @ApiProperty({
    description: "Whether the poll had ended by the server's clock",
  })
  ended!: boolean;

  @ApiProperty({ enum: [...POLL_RESULTS_VISIBILITIES] })
  resultsVisibility!: PollResultsVisibility;

  @ApiProperty({ enum: [...POLL_SUGGESTION_MODES] })
  suggestions!: PollSuggestionMode;

  @ApiProperty({ description: 'Whether the reader wrote the quack' })
  isAuthor!: boolean;

  @ApiProperty()
  resultsVisible!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  totalVotes!: number | null;

  @ApiProperty({ type: String, nullable: true })
  myVoteOptionId!: string | null;

  @ApiProperty({ description: 'Whether the reader may suggest an answer now' })
  canSuggest!: boolean;

  @ApiProperty({
    type: [PollOptionDto],
    description: 'Published answers in their fixed order',
  })
  options!: PollOptionDto[];

  @ApiProperty({
    type: [PendingSuggestionDto],
    description:
      'Suggestions awaiting approval: all of them for the author, their own for a suggester, none for anyone else',
  })
  pendingSuggestions!: PendingSuggestionDto[];

  static fromDomain(view: PollView): PollResponseDto {
    return {
      endsAt: view.endsAt,
      ended: view.ended,
      resultsVisibility: view.resultsVisibility,
      suggestions: view.suggestions,
      isAuthor: view.isAuthor,
      resultsVisible: view.resultsVisible,
      totalVotes: view.totalVotes,
      myVoteOptionId: view.myVoteOptionId,
      canSuggest: view.canSuggest,
      options: view.options.map(({ id, text, votes }) => ({ id, text, votes })),
      pendingSuggestions: view.pendingSuggestions.map(({ id, text }) => ({
        id,
        text,
      })),
    };
  }
}
