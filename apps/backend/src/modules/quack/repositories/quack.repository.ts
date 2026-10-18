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
import { Mood, Quack } from '@/modules/quack/domain/quack';
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
});

const WITH_USER_AND_POLL = {
  user: true,
  poll: { include: { options: true } },
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

  // Every quack, or only those where every word matches somewhere. No words
  // means no filter. Poll options are not searched. Polls are read for
  // `viewerId`, whose own vote comes with them.
  async getQuacks(words: string[] = [], viewerId = ''): Promise<Quack[]> {
    return this.prisma.$transaction(async (tx) => {
      const quacks = await tx.quack.findMany({
        where: { AND: words.map(matchesWord) },
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
}
