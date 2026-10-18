import { PrismaService } from '@/core/prisma/prisma.service';
import {
  normalizePollOption,
  POLL_LENGTH_MS,
  PollLength,
  PollResultsVisibility,
  PollSuggestionMode,
} from '@/modules/quack/domain/poll';

const MINUTE_IN_MS = 60 * 1000;

type AddPollParams = {
  quackId: string;
  authorId: string;
  // When the quack was posted. The poll starts then, so its end, and whether
  // it has already ended, follows from the length.
  createdAt: Date;
  length: PollLength;
  results?: PollResultsVisibility;
  suggestions?: PollSuggestionMode;
  // Published answers, in order.
  options: string[];
  // Who chose which of `options`.
  votes?: { userId: string; option: string }[];
  // Answers from other users still waiting for the author's approval.
  pending?: { userId: string; text: string }[];
};

// Attaches a poll to a seeded quack. Settings left out take the defaults the
// form offers for a new poll.
export async function addPoll(
  prisma: PrismaService,
  params: AddPollParams,
): Promise<void> {
  const { quackId, authorId, createdAt, length, votes = [] } = params;
  const duration = POLL_LENGTH_MS[length];
  // Votes and suggestions arrive a minute apart, from a minute after the start.
  const minutesLater = (minutes: number): Date =>
    new Date(createdAt.getTime() + minutes * MINUTE_IN_MS);

  const poll = await prisma.poll.create({
    data: {
      quack: { connect: { id: quackId } },
      endsAt:
        duration === null ? null : new Date(createdAt.getTime() + duration),
      resultsVisibility: params.results ?? 'immediately',
      suggestions: params.suggestions ?? 'not_allowed',
      createdAt,
      options: {
        create: [
          ...params.options.map((text, position) => ({
            text,
            normalizedText: normalizePollOption(text),
            status: 'published' as const,
            position,
            createdBy: { connect: { id: authorId } },
            createdAt,
          })),
          ...(params.pending ?? []).map(({ userId, text }, i) => ({
            text,
            normalizedText: normalizePollOption(text),
            status: 'pending' as const,
            position: null,
            createdBy: { connect: { id: userId } },
            createdAt: minutesLater(i + 1),
          })),
        ],
      },
    },
    include: { options: true },
  });

  // Only published answers can be voted for.
  const optionIds = new Map(
    poll.options
      .filter((o) => o.status === 'published')
      .map((o) => [o.text, o.id]),
  );
  await prisma.pollVote.createMany({
    data: votes.map(({ userId, option }, i) => {
      const optionId = optionIds.get(option);
      if (!optionId) throw new Error(`Seed vote for unknown answer: ${option}`);
      return {
        pollId: quackId,
        userId,
        optionId,
        createdAt: minutesLater(i + 1),
        updatedAt: minutesLater(i + 1),
      };
    }),
  });
}
