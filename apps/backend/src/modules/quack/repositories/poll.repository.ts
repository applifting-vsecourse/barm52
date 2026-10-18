import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  isPollEnded,
  MAX_POLL_OPTIONS,
  normalizePollOption,
  Poll,
} from '@/modules/quack/domain/poll';
import { Injectable } from '@nestjs/common';
import {
  CONSISTENT_READ,
  mapPrismaPollToDomain,
  readPollStats,
} from './poll-mapping';

export type VoteOutcome = 'not_found' | 'ended' | 'unchanged' | 'changed';

export type SuggestOutcome =
  | 'not_found'
  | 'not_allowed'
  | 'ended'
  | 'full'
  | 'duplicate'
  | 'limit_reached'
  | 'added_by_author'
  | 'added_by_other';

export type DecideOutcome =
  'not_found' | 'forbidden' | 'ended' | 'suggestion_not_found' | 'done';

// Locks the poll row until the transaction ends. Every change to a poll's
// options takes this lock first, so two of them never interleave: the cap of
// ten and the one-answer-per-person limit can't be raced past.
const lockPoll = async (
  tx: Prisma.TransactionClient,
  quackId: string,
): Promise<boolean> => {
  const rows = await tx.$queryRaw<{ quackId: string }[]>`
    SELECT "quackId" FROM "poll" WHERE "quackId" = ${quackId} FOR UPDATE`;
  return rows.length > 0;
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class PollRepository {
  constructor(private readonly prisma: PrismaService) {}

  // The poll of a quack as `viewerId` sees it, or null without one.
  async getPoll(quackId: string, viewerId: string): Promise<Poll | null> {
    return this.prisma.$transaction(async (tx) => {
      const poll = await tx.poll.findUnique({
        where: { quackId },
        include: { options: true, quack: { select: { userId: true } } },
      });
      if (!poll) return null;
      const stats = await readPollStats(tx, [quackId], viewerId);
      return mapPrismaPollToDomain(poll, poll.quack.userId, stats);
    }, CONSISTENT_READ);
  }

  // Records the user's choice. A vote is accepted only while the poll is open
  // at `now`, and only for a published option of this very poll.
  async castVote(params: {
    quackId: string;
    userId: string;
    optionId: string;
    now: Date;
  }): Promise<VoteOutcome> {
    const { quackId, userId, optionId, now } = params;
    const option = await this.prisma.pollOption.findFirst({
      where: { id: optionId, pollId: quackId, status: 'published' },
      include: { poll: { select: { endsAt: true } } },
    });
    if (!option) return 'not_found';
    if (isPollEnded(option.poll, now)) return 'ended';

    const current = await this.prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: quackId, userId } },
      select: { optionId: true },
    });
    if (current?.optionId === optionId) return 'unchanged';

    // One statement: a first vote inserts the row, a change moves it. Nobody
    // reading meanwhile sees the user counted twice or not at all, and two
    // requests from one user racing each other still leave a single row.
    await this.prisma.$executeRaw`
      INSERT INTO "poll_vote" ("pollId", "userId", "optionId", "createdAt", "updatedAt")
      VALUES (${quackId}, ${userId}, ${optionId}, now(), now())
      ON CONFLICT ("pollId", "userId")
      DO UPDATE SET "optionId" = EXCLUDED."optionId", "updatedAt" = now()`;
    return 'changed';
  }

  // A new answer from `userId`. The author's answers are published at once;
  // anyone else's waits for approval when the poll asks for it.
  async suggestOption(params: {
    quackId: string;
    userId: string;
    text: string;
    now: Date;
  }): Promise<SuggestOutcome> {
    const { quackId, userId, now } = params;
    const text = params.text.trim();
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockPoll(tx, quackId))) return 'not_found';
        const poll = await tx.poll.findUniqueOrThrow({
          where: { quackId },
          include: { options: true, quack: { select: { userId: true } } },
        });
        if (poll.suggestions === 'not_allowed') return 'not_allowed';
        if (isPollEnded(poll, now)) return 'ended';
        if (poll.options.length >= MAX_POLL_OPTIONS) return 'full';
        const normalizedText = normalizePollOption(text);
        if (poll.options.some((o) => o.normalizedText === normalizedText)) {
          return 'duplicate';
        }
        const isAuthor = poll.quack.userId === userId;
        if (!isAuthor && poll.options.some((o) => o.createdById === userId)) {
          return 'limit_reached';
        }

        const published = isAuthor || poll.suggestions === 'published';
        await tx.pollOption.create({
          data: {
            pollId: quackId,
            text,
            normalizedText,
            status: published ? 'published' : 'pending',
            position: published ? nextPosition(poll.options) : null,
            createdById: userId,
          },
        });
        return isAuthor ? 'added_by_author' : 'added_by_other';
      });
    } catch (error) {
      // The lock already rules this out; the unique index is the backstop.
      if (isUniqueViolation(error)) return 'duplicate';
      throw error;
    }
  }

  // The author approves (publishes) or rejects (deletes) a pending suggestion.
  async decideSuggestion(params: {
    quackId: string;
    optionId: string;
    userId: string;
    decision: 'approve' | 'reject';
    now: Date;
  }): Promise<DecideOutcome> {
    const { quackId, optionId, userId, decision, now } = params;
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockPoll(tx, quackId))) return 'not_found';
      const poll = await tx.poll.findUniqueOrThrow({
        where: { quackId },
        include: { options: true, quack: { select: { userId: true } } },
      });
      if (poll.quack.userId !== userId) return 'forbidden';
      if (isPollEnded(poll, now)) return 'ended';
      const suggestion = poll.options.find(
        (o) => o.id === optionId && o.status === 'pending',
      );
      if (!suggestion) return 'suggestion_not_found';

      if (decision === 'approve') {
        await tx.pollOption.update({
          where: { id: optionId },
          data: { status: 'published', position: nextPosition(poll.options) },
        });
      } else {
        await tx.pollOption.delete({ where: { id: optionId } });
      }
      return 'done';
    });
  }
}

// A newly published answer goes to the end of the list.
const nextPosition = (options: { position: number | null }[]): number =>
  options.reduce((max, o) => Math.max(max, o.position ?? -1), -1) + 1;
