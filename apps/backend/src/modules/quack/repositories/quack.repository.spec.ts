// Prisma is faked, the repository is real. The service spec can't see this
// layer, and it is where a forgotten `mood` would slip past the compiler:
// Prisma accepts a create without it, and the quack would silently lose its mood.
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { QuackRepository } from './quack.repository';

const aPrismaUser = (): PrismaUser => ({
  id: 'u1',
  name: 'Caffeinated Duck',
  email: 'caffeinatedduck@example.com',
  emailVerified: true,
  image: null,
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  role: 'user',
  username: 'CaffeinatedDuck',
  displayUsername: null,
});

const aPrismaQuack = (
  overrides: Partial<PrismaQuack> = {},
): PrismaQuack & { user: PrismaUser } => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: aPrismaUser(),
  ...overrides,
});

describe('QuackRepository', () => {
  const quack = { create: jest.fn(), findMany: jest.fn() };
  const repository = new QuackRepository({ quack } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('writes the mood to the database and returns it', async () => {
    quack.create.mockResolvedValue(aPrismaQuack({ mood: 'angry' }));

    const created = await repository.createQuack({
      text: 'grr',
      mood: 'angry',
      userId: 'u1',
    });

    expect(quack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mood: 'angry' }),
      }),
    );
    expect(created.mood).toBe('angry');
  });

  it('writes a quack without a mood as null', async () => {
    quack.create.mockResolvedValue(aPrismaQuack());

    const created = await repository.createQuack({
      text: 'hello',
      mood: null,
      userId: 'u1',
    });

    expect(quack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mood: null }),
      }),
    );
    expect(created.mood).toBeNull();
  });

  it('lists each quack with the mood it was stored with', async () => {
    quack.findMany.mockResolvedValue([
      aPrismaQuack({ id: 'q2', mood: 'sad' }),
      aPrismaQuack({ id: 'q1', mood: null }),
    ]);

    const quacks = await repository.getQuacks();

    expect(quacks.map(({ id, mood }) => ({ id, mood }))).toEqual([
      { id: 'q2', mood: 'sad' },
      { id: 'q1', mood: null },
    ]);
  });

  describe('searching', () => {
    // One word matches when it is in the text, the author's name or their
    // username, whatever the case.
    const matches = (contains: string): object => ({
      OR: [
        { text: { contains, mode: 'insensitive' } },
        { user: { name: { contains, mode: 'insensitive' } } },
        { user: { username: { contains, mode: 'insensitive' } } },
      ],
    });

    beforeEach(() => {
      quack.findMany.mockResolvedValue([]);
    });

    it('does not filter without words', async () => {
      await repository.getQuacks();

      expect(quack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [] } }),
      );
    });

    it('wants every word to match, newest quack first', async () => {
      await repository.getQuacks(['duck', 'coffee']);

      expect(quack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [matches('duck'), matches('coffee')] },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    // Prisma passes `contains` on to ILIKE unescaped, so these would otherwise
    // be wildcards and `%` would match every quack.
    it.each([
      ['%', '\\%'],
      ['_', '\\_'],
      ['\\', '\\\\'],
      ['100%_off\\', '100\\%\\_off\\\\'],
    ])('matches %j literally', async (word, escaped) => {
      await repository.getQuacks([word]);

      expect(quack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [matches(escaped)] } }),
      );
    });
  });
});
