// Runs against a real Postgres (`pnpm backend test:db`). The rules checked
// here are kept by the database itself: unique keys, the poll row lock,
// one-statement upserts, the transaction around a nested create. A faked Prisma
// can't race, so only a real database shows they hold. IDs refer to story.md.
import { PrismaService } from '@/core/prisma/prisma.service';
import { User } from '@/generated/prisma/client';
import {
  Poll,
  PollResultsVisibility,
  PollSuggestionMode,
  toPollView,
} from '@/modules/quack/domain/poll';
import { PollRepository } from './poll.repository';
import { QuackRepository } from './quack.repository';

const prisma = new PrismaService();
const quackRepository = new QuackRepository(prisma);
const pollRepository = new PollRepository(prisma);

const createUser = (name: string): Promise<User> =>
  prisma.user.create({
    data: {
      id: `user-${name}`,
      name,
      email: `${name}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      username: name,
    },
  });

const createUsers = (prefix: string, count: number): Promise<User[]> =>
  Promise.all(
    Array.from({ length: count }, (_, i) => createUser(`${prefix}-${i + 1}`)),
  );

const createPoll = async (
  author: User,
  options: string[],
  settings: {
    endsAt?: Date | null;
    resultsVisibility?: PollResultsVisibility;
    suggestions?: PollSuggestionMode;
  } = {},
): Promise<Poll> => {
  const quack = await quackRepository.createQuack({
    text: 'Where should the next pond meetup be?',
    mood: null,
    userId: author.id,
    poll: {
      options,
      endsAt: null,
      resultsVisibility: 'immediately',
      suggestions: 'not_allowed',
      ...settings,
    },
  });
  if (!quack.poll) throw new Error('The quack was created without its poll');
  return quack.poll;
};

const readPoll = async (quackId: string, viewerId = ''): Promise<Poll> => {
  const poll = await pollRepository.getPoll(quackId, viewerId);
  if (!poll) throw new Error(`No poll on quack ${quackId}`);
  return poll;
};

const optionId = (poll: Poll, text: string): string => {
  const option = poll.options.find((o) => o.text === text);
  if (!option) throw new Error(`No option "${text}"`);
  return option.id;
};

// Published counts by answer text, plus the total a reader would be shown.
const readCounts = async (
  quackId: string,
): Promise<{ votes: Record<string, number>; total: number | null }> => {
  const poll = await readPoll(quackId);
  return {
    votes: Object.fromEntries(
      poll.options
        .filter((o) => o.status === 'published')
        .map((o) => [o.text, o.votes]),
    ),
    total: toPollView(poll, '', new Date()).totalVotes,
  };
};

const vote = (
  poll: Poll,
  user: User,
  text: string,
  now = new Date(),
): ReturnType<PollRepository['castVote']> =>
  pollRepository.castVote({
    quackId: poll.quackId,
    userId: user.id,
    optionId: optionId(poll, text),
    now,
  });

const suggest = (
  poll: Poll,
  user: User,
  text: string,
  now = new Date(),
): ReturnType<PollRepository['suggestOption']> =>
  pollRepository.suggestOption({
    quackId: poll.quackId,
    userId: user.id,
    text,
    now,
  });

// What F1 demands: one count per answer, equal to the users whose current vote
// it is, from a model of who voted for what.
const expectedCounts = (
  options: string[],
  currentVotes: Map<string, string>,
): Record<string, number> =>
  Object.fromEntries(
    options.map((text) => [
      text,
      [...currentVotes.values()].filter((choice) => choice === text).length,
    ]),
  );

const sorted = <T>(items: T[]): T[] => [...items].sort();

describe('polls against a real database', () => {
  let author: User;

  beforeEach(async () => {
    // CASCADE from "user" also empties the auth tables that reference it.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "poll_vote", "poll_option", "poll", "quack", "user" CASCADE',
    );
    author = await createUser('author');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('creating a poll', () => {
    it('A4: leaves no quack behind when an answer repeats after normalisation', async () => {
      await expect(
        quackRepository.createQuack({
          text: 'Lunch?',
          mood: null,
          userId: author.id,
          poll: {
            options: ['Pizza', 'pizza'],
            endsAt: null,
            resultsVisibility: 'immediately',
            suggestions: 'not_allowed',
          },
        }),
      ).rejects.toThrow();

      expect(await prisma.quack.count()).toBe(0);
      expect(await prisma.poll.count()).toBe(0);
      expect(await prisma.pollOption.count()).toBe(0);
    });
  });

  describe('voting', () => {
    it('F3: counts every one of 20 users voting for the same answer at once', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads']);
      const voters = await createUsers('voter', 20);

      const outcomes = await Promise.all(
        voters.map((voter) => vote(poll, voter, 'Reeds')),
      );

      expect(outcomes).toEqual(voters.map(() => 'changed'));
      expect(await readCounts(poll.quackId)).toEqual({
        votes: { Reeds: 20, 'Lily pads': 0 },
        total: 20,
      });
    });

    it('F2: keeps one vote when one user votes for different answers at once', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads']);
      const voter = await createUser('voter');

      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          vote(poll, voter, i % 2 === 0 ? 'Reeds' : 'Lily pads'),
        ),
      );

      const rows = await prisma.pollVote.findMany({
        where: { pollId: poll.quackId },
      });
      expect(rows).toHaveLength(1);
      const { votes, total } = await readCounts(poll.quackId);
      expect(votes.Reeds + votes['Lily pads']).toBe(1);
      expect(total).toBe(1);
      // The count follows the one row, whichever request won.
      const winner = poll.options.find((o) => o.id === rows[0].optionId);
      expect(winner && votes[winner.text]).toBe(1);
    });

    it('F2: the database refuses a second vote row for the same user and poll', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads']);
      const voter = await createUser('voter');
      await vote(poll, voter, 'Reeds');

      await expect(
        prisma.pollVote.create({
          data: {
            pollId: poll.quackId,
            userId: voter.id,
            optionId: optionId(poll, 'Lily pads'),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      expect(await readCounts(poll.quackId)).toEqual({
        votes: { Reeds: 1, 'Lily pads': 0 },
        total: 1,
      });
    });

    it('F4: a change moves the vote: A -1, B +1, total unchanged', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads']);
      const [first, second] = await createUsers('voter', 2);
      await vote(poll, first, 'Reeds');
      await vote(poll, second, 'Reeds');

      expect(await vote(poll, first, 'Lily pads')).toBe('changed');

      expect(await readCounts(poll.quackId)).toEqual({
        votes: { Reeds: 1, 'Lily pads': 1 },
        total: 2,
      });
    });

    it('F1: after each vote and change every count equals the users whose current vote it is', async () => {
      const options = ['Reeds', 'Lily pads', 'Mud'];
      const poll = await createPoll(author, options);
      const [a, b, c, d] = await createUsers('voter', 4);
      const currentVotes = new Map<string, string>();
      const steps: [User, string][] = [
        [a, 'Reeds'],
        [b, 'Reeds'],
        [c, 'Mud'],
        [a, 'Lily pads'],
        [d, 'Lily pads'],
        [b, 'Mud'],
        [author, 'Reeds'],
        [c, 'Reeds'],
        [a, 'Reeds'],
      ];

      for (const [user, choice] of steps) {
        await vote(poll, user, choice);
        currentVotes.set(user.id, choice);

        expect(await readCounts(poll.quackId)).toEqual({
          votes: expectedCounts(options, currentVotes),
          total: currentVotes.size,
        });
      }
    });

    it('F1/F4: a reader never sees a voter counted twice or not at all while votes change', async () => {
      const options = ['Reeds', 'Lily pads', 'Mud'];
      const poll = await createPoll(author, options);
      const voters = await createUsers('voter', 12);
      await Promise.all(voters.map((voter) => vote(poll, voter, 'Reeds')));

      // Each voter changes their mind five times in a row, all voters at once.
      const rounds = 5;
      const finalChoice = (i: number): string =>
        options[(i + rounds) % options.length];
      let changing = true;
      const totalsSeen: number[] = [];
      const reader = (async (): Promise<void> => {
        do {
          const { votes } = await readCounts(poll.quackId);
          totalsSeen.push(Object.values(votes).reduce((x, y) => x + y, 0));
        } while (changing);
      })();
      await Promise.all(
        voters.map(async (voter, i) => {
          for (let round = 1; round <= rounds; round++) {
            await vote(poll, voter, options[(i + round) % options.length]);
          }
        }),
      );
      changing = false;
      await reader;

      expect(new Set(totalsSeen)).toEqual(new Set([voters.length]));
      expect(await readCounts(poll.quackId)).toEqual({
        votes: expectedCounts(
          options,
          new Map(voters.map((voter, i) => [voter.id, finalChoice(i)])),
        ),
        total: voters.length,
      });
    });

    it('C3: voting for the answer already chosen changes nothing', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads']);
      const voter = await createUser('voter');
      await vote(poll, voter, 'Reeds');
      const before = await prisma.pollVote.findMany();

      expect(await vote(poll, voter, 'Reeds')).toBe('unchanged');

      expect(await prisma.pollVote.findMany()).toEqual(before);
      expect(await readCounts(poll.quackId)).toEqual({
        votes: { Reeds: 1, 'Lily pads': 0 },
        total: 1,
      });
    });

    it("C6: refuses an answer of another poll, a pending suggestion, a quack without a poll and a quack that doesn't exist", async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads'], {
        suggestions: 'author_approves',
      });
      const other = await createPoll(author, ['North bank', 'South bank']);
      const [voter, suggester] = await createUsers('voter', 2);
      await suggest(poll, suggester, 'Mud');
      const pendingId = optionId(await readPoll(poll.quackId), 'Mud');
      const plainQuack = await quackRepository.createQuack({
        text: 'Just a quack',
        mood: null,
        userId: author.id,
      });
      const attempt = (quackId: string, optionId: string): Promise<string> =>
        pollRepository.castVote({
          quackId,
          userId: voter.id,
          optionId,
          now: new Date(),
        });

      expect(await attempt(poll.quackId, optionId(other, 'North bank'))).toBe(
        'not_found',
      );
      expect(await attempt(poll.quackId, pendingId)).toBe('not_found');
      expect(await attempt(plainQuack.id, optionId(poll, 'Reeds'))).toBe(
        'not_found',
      );
      expect(await attempt('no-such-quack', optionId(poll, 'Reeds'))).toBe(
        'not_found',
      );

      expect(await prisma.pollVote.count()).toBe(0);
    });

    it('X1.4: accepts a vote 1 ms before the end and refuses one at the end', async () => {
      const endsAt = new Date('2026-10-18T12:00:00.000Z');
      const justBefore = new Date(endsAt.getTime() - 1);
      const poll = await createPoll(author, ['Reeds', 'Lily pads'], {
        endsAt,
      });
      const [late, onTime] = await createUsers('voter', 2);

      expect(await vote(poll, late, 'Reeds', endsAt)).toBe('ended');
      expect(await vote(poll, onTime, 'Reeds', justBefore)).toBe('changed');
      // Nor can the vote be moved once the poll has ended.
      expect(await vote(poll, onTime, 'Lily pads', endsAt)).toBe('ended');

      expect(await readCounts(poll.quackId)).toEqual({
        votes: { Reeds: 1, 'Lily pads': 0 },
        total: 1,
      });
      const rows = await prisma.pollVote.findMany();
      expect(rows).toEqual([
        expect.objectContaining({
          userId: onTime.id,
          optionId: optionId(poll, 'Reeds'),
        }),
      ]);
    });
  });

  describe('suggesting answers', () => {
    it('X3.10: of two identical suggestions at once exactly one is added', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads'], {
        suggestions: 'published',
      });
      const [first, second] = await createUsers('suggester', 2);

      const outcomes = await Promise.all([
        suggest(poll, first, 'Mud'),
        suggest(poll, second, 'Mud'),
      ]);

      expect(sorted(outcomes)).toEqual(['added_by_other', 'duplicate']);
      const options = await prisma.pollOption.findMany({
        where: { pollId: poll.quackId, normalizedText: 'mud' },
      });
      expect(options).toHaveLength(1);
    });

    it('X3.10: with 9 of 10 answers taken, one of five suggestions at once is added', async () => {
      const poll = await createPoll(
        author,
        Array.from({ length: 9 }, (_, i) => `Spot ${i + 1}`),
        { suggestions: 'published' },
      );
      const suggesters = await createUsers('suggester', 5);

      const outcomes = await Promise.all(
        suggesters.map((user, i) => suggest(poll, user, `Corner ${i + 1}`)),
      );

      expect(sorted(outcomes)).toEqual([
        'added_by_other',
        'full',
        'full',
        'full',
        'full',
      ]);
      expect(
        await prisma.pollOption.count({ where: { pollId: poll.quackId } }),
      ).toBe(10);
    });

    it('X3.4: a non-author keeps one active answer', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads'], {
        suggestions: 'published',
      });
      const suggester = await createUser('suggester');

      expect(await suggest(poll, suggester, 'Mud')).toBe('added_by_other');
      expect(await suggest(poll, suggester, 'Sand')).toBe('limit_reached');
    });

    it('X3.4: rejecting a suggestion frees the slot', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads'], {
        suggestions: 'author_approves',
      });
      const suggester = await createUser('suggester');
      await suggest(poll, suggester, 'Mud');
      expect(await suggest(poll, suggester, 'Sand')).toBe('limit_reached');

      const rejected = await pollRepository.decideSuggestion({
        quackId: poll.quackId,
        optionId: optionId(await readPoll(poll.quackId), 'Mud'),
        userId: author.id,
        decision: 'reject',
        now: new Date(),
      });

      expect(rejected).toBe('done');
      expect(await suggest(poll, suggester, 'Sand')).toBe('added_by_other');
    });

    it('X3.4: the author is exempt from the limit per person', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads'], {
        suggestions: 'author_approves',
      });

      expect(await suggest(poll, author, 'Mud')).toBe('added_by_author');
      expect(await suggest(poll, author, 'Sand')).toBe('added_by_author');

      const published = (await readPoll(poll.quackId)).options.filter(
        (o) => o.status === 'published',
      );
      expect(published).toHaveLength(4);
    });

    it('X3.6/X3.7: a suggestion waits for the author, who publishes it at the end with no votes', async () => {
      const poll = await createPoll(author, ['Reeds', 'Lily pads'], {
        suggestions: 'author_approves',
      });
      const [suggester, voter] = await createUsers('user', 2);
      await vote(poll, voter, 'Reeds');

      expect(await suggest(poll, suggester, 'Mud')).toBe('added_by_other');
      const waiting = await readPoll(poll.quackId);
      const waitingId = optionId(waiting, 'Mud');
      expect(waiting.options.find((o) => o.id === waitingId)).toMatchObject({
        status: 'pending',
        position: null,
      });
      // Published while the suggestion waits, so the end has moved on since.
      expect(await suggest(poll, author, 'Sand')).toBe('added_by_author');

      const decide = (
        userId: string,
      ): ReturnType<PollRepository['decideSuggestion']> =>
        pollRepository.decideSuggestion({
          quackId: poll.quackId,
          optionId: waitingId,
          userId,
          decision: 'approve',
          now: new Date(),
        });

      expect(await decide(suggester.id)).toBe('forbidden');
      expect(await decide(author.id)).toBe('done');
      expect(await decide(author.id)).toBe('suggestion_not_found');

      const approved = (await readPoll(poll.quackId)).options.find(
        (o) => o.text === 'Mud',
      );
      expect(approved).toMatchObject({
        status: 'published',
        position: 3,
        votes: 0,
      });
      expect(await readCounts(poll.quackId)).toEqual({
        votes: { Reeds: 1, 'Lily pads': 0, Sand: 0, Mud: 0 },
        total: 1,
      });
    });
  });
});
