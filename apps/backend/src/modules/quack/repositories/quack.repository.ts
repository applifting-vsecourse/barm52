import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import {
  normalizePollOption,
  PollResultsVisibility,
  PollSuggestionMode,
} from '@/modules/quack/domain/poll';
import { Mood, Quack, QuackState } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';
import {
  CONSISTENT_READ,
  mapPrismaPollToDomain,
  NO_POLL_STATS,
  PollStats,
  readPollStats,
} from './poll-mapping';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & {
    user?: PrismaUser;
    poll?: (PrismaPoll & { options: PrismaPollOption[] }) | null;
    _count?: { replies: number };
  },
  pollStats: PollStats = NO_POLL_STATS,
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
  poll: quack.poll
    ? mapPrismaPollToDomain(quack.poll, quack.userId, pollStats)
    : null,
  parentId: quack.parentId,
  deleted: quack.deletedAt !== null,
  replyCount: quack._count?.replies ?? 0,
});

const WITH_USER_AND_POLL = {
  user: true,
  poll: { include: { options: true } },
  _count: { select: { replies: true } },
} satisfies Prisma.QuackInclude;

// Prisma hands `contains` to ILIKE as it is, so a typed %, _ or \ would act as a
// wildcard instead of matching itself.
const escapeLike = (word: string): string => word.replace(/[\\%_]/g, '\\$&');

const matchesWord = (word: string): Prisma.QuackWhereInput => {
  const contains = escapeLike(word);
  return {
    OR: [
      { text: { contains, mode: 'insensitive' } },
      { user: { name: { contains, mode: 'insensitive' } } },
      { user: { username: { contains, mode: 'insensitive' } } },
    ],
  };
};

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Every top-level quack, or only those where every word matches somewhere.
  // No words means no filter. Poll options and replies are not searched. Polls
  // are read for `viewerId`, whose own vote comes with them. With `authorId`,
  // only that user's quacks. A deleted quack shows only as the placeholder
  // that holds its replies in the plain feed; a search or Mine never finds it.
  async getQuacks(
    words: string[] = [],
    viewerId = '',
    authorId?: string,
  ): Promise<Quack[]> {
    return this.prisma.$transaction(async (tx) => {
      const quacks = await tx.quack.findMany({
        where: {
          AND: [
            { parentId: null },
            words.length > 0 || authorId
              ? { deletedAt: null }
              : { OR: [{ deletedAt: null }, { replies: { some: {} } }] },
            ...words.map(matchesWord),
            ...(authorId ? [{ userId: authorId }] : []),
          ],
        },
        include: WITH_USER_AND_POLL,
        orderBy: { createdAt: 'desc' },
      });
      const pollIds = quacks.flatMap((quack) =>
        quack.poll ? [quack.poll.quackId] : [],
      );
      const stats = await readPollStats(tx, pollIds, viewerId);
      return quacks.map((quack) => mapPrismaQuackToDomain(quack, stats));
    }, CONSISTENT_READ);
  }

  // The quack and its poll are written in one statement, so either both exist
  // afterwards or neither does.
  async createQuack(createQuackData: {
    text: string;
    mood: Mood | null;
    userId: string;
    poll?: {
      options: string[];
      endsAt: Date | null;
      resultsVisibility: PollResultsVisibility;
      suggestions: PollSuggestionMode;
    };
  }): Promise<Quack> {
    const { poll, userId } = createQuackData;
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: userId } },
        ...(poll
          ? {
              poll: {
                create: {
                  endsAt: poll.endsAt,
                  resultsVisibility: poll.resultsVisibility,
                  suggestions: poll.suggestions,
                  options: {
                    // Positions follow the order the author typed them in.
                    create: poll.options.map((text, position) => ({
                      text,
                      normalizedText: normalizePollOption(text),
                      status: 'published' as const,
                      position,
                      createdBy: { connect: { id: userId } },
                    })),
                  },
                },
              },
            }
          : {}),
      },
      include: WITH_USER_AND_POLL,
    });
    return mapPrismaQuackToDomain(quack);
  }

  // The replies to a quack, oldest first. Replies carry no poll, so there are
  // no poll numbers to read.
  async getReplies(parentId: string): Promise<Quack[]> {
    const replies = await this.prisma.quack.findMany({
      where: { parentId },
      include: WITH_USER_AND_POLL,
      orderBy: { createdAt: 'asc' },
    });
    return replies.map((reply) => mapPrismaQuackToDomain(reply));
  }

  async createReply(reply: {
    parentId: string;
    userId: string;
    text: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: reply.text,
        mood: null,
        user: { connect: { id: reply.userId } },
        parent: { connect: { id: reply.parentId } },
      },
      include: WITH_USER_AND_POLL,
    });
    return mapPrismaQuackToDomain(quack);
  }

  // Who wrote the quack and where it sits, or null when there is no such quack.
  async getQuackState(quackId: string): Promise<QuackState | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      select: { userId: true, parentId: true, deletedAt: true },
    });
    return quack
      ? {
          authorId: quack.userId,
          parentId: quack.parentId,
          deleted: quack.deletedAt !== null,
        }
      : null;
  }

  // How Quacker deletes, docs/adr/0001-delete-wipes-content-keeps-replies.md:
  // a quack with replies keeps its row as a placeholder, with the text, mood
  // and poll wiped; anything else is deleted for good (the poll, answers and
  // votes cascade). A deleted reply that was the last one under a placeholder
  // takes the placeholder with it. One transaction, so a reply never loses
  // its parent halfway.
  async deleteQuack(quackId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const quack = await tx.quack.findUnique({
        where: { id: quackId },
        select: { parentId: true, _count: { select: { replies: true } } },
      });
      if (!quack) return;

      if (quack._count.replies > 0) {
        await tx.poll.deleteMany({ where: { quackId } });
        await tx.quack.update({
          where: { id: quackId },
          data: { text: '', mood: null, deletedAt: new Date() },
        });
        return;
      }

      await tx.quack.delete({ where: { id: quackId } });
      if (quack.parentId) {
        await tx.quack.deleteMany({
          where: {
            id: quack.parentId,
            deletedAt: { not: null },
            replies: { none: {} },
          },
        });
      }
    });
  }
}
