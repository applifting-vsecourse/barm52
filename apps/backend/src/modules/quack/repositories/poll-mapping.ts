import {
  Prisma,
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
} from '@/generated/prisma/client';
import { Poll } from '@/modules/quack/domain/poll';

// Shared by the quack and poll repositories, which both hand out polls.

// Every read that returns poll numbers runs in one of these, so the counts, the
// total and the reader's own vote in a response all come from one snapshot.
export const CONSISTENT_READ = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
};

export type PollStats = {
  // Votes per option id. Options nobody chose are missing.
  votesByOption: Map<string, number>;
  // The reader's vote per poll id.
  myVoteByPoll: Map<string, string>;
};

export const NO_POLL_STATS: PollStats = {
  votesByOption: new Map(),
  myVoteByPoll: new Map(),
};

// Counts are computed from the votes every time, never stored, so they can't
// drift from who actually voted.
export const readPollStats = async (
  db: Prisma.TransactionClient,
  pollIds: string[],
  viewerId: string,
): Promise<PollStats> => {
  if (pollIds.length === 0) return NO_POLL_STATS;
  const counts = await db.pollVote.groupBy({
    by: ['optionId'],
    where: { pollId: { in: pollIds } },
    _count: { _all: true },
  });
  const myVotes = await db.pollVote.findMany({
    where: { pollId: { in: pollIds }, userId: viewerId },
    select: { pollId: true, optionId: true },
  });
  return {
    votesByOption: new Map(counts.map((c) => [c.optionId, c._count._all])),
    myVoteByPoll: new Map(myVotes.map((v) => [v.pollId, v.optionId])),
  };
};

export const mapPrismaPollToDomain = (
  poll: PrismaPoll & { options: PrismaPollOption[] },
  authorId: string,
  stats: PollStats,
): Poll => ({
  quackId: poll.quackId,
  authorId,
  endsAt: poll.endsAt,
  resultsVisibility: poll.resultsVisibility,
  suggestions: poll.suggestions,
  options: poll.options.map((option) => ({
    id: option.id,
    text: option.text,
    status: option.status,
    position: option.position,
    createdById: option.createdById,
    createdAt: option.createdAt,
    votes: stats.votesByOption.get(option.id) ?? 0,
  })),
  myVoteOptionId: stats.myVoteByPoll.get(poll.quackId) ?? null,
});
