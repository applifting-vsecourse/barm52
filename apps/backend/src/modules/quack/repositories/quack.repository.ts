import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Mood, Quack } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
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
});

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
  // means no filter.
  async getQuacks(words: string[] = []): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: { AND: words.map(matchesWord) },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood: Mood | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: { user: true },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
