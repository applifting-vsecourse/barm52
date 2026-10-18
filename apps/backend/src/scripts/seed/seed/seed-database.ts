import { PrismaService } from '@/core/prisma/prisma.service';
import { User } from '@/generated/prisma/client';
import {
  PollLength,
  PollResultsVisibility,
  PollSuggestionMode,
} from '@/modules/quack/domain/poll';
import { Mood } from '@/modules/quack/domain/quack';
import { BetterAuth } from '@/shared/auth/providers/better-auth.provider';
import { Config } from '@/shared/config/config.service';
import { addPoll } from './create-poll';
import { createQuack } from './create-quack';
import { createUser } from './create-user';

const MINUTE_IN_MS = 60 * 1000;

export const seedDatabase = async (
  prisma: PrismaService,
  config: Config,
  betterAuth: BetterAuth,
): Promise<void> => {
  const auth = betterAuth;

  // `pnpm dev` runs the seed on every start, so never clobber a database that
  // already has data — that would delete the account and posts you just made.
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(
      `Database already has ${existingUsers} user(s) — skipping seed. ` +
        'Run `pnpm backend db:reset` to wipe and start over.',
    );
    return;
  }

  // Drop existing database data from all tables. The poll tables reference
  // "quack" and "user", so CASCADE empties them too.
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "quack", "session", "account", "verification", "user" RESTART IDENTITY CASCADE;',
    );
  } catch (error) {
    console.error('Error truncating tables:', error);
  }

  console.log('Creating superadmin user');

  // Create a superadmin user. This should be delete in prod app
  await createUser(prisma, auth, {
    email: config.superadminEmail,
    password: config.superadminPassword,
    name: 'Admin (Delete in Prod)',
    username: 'superadmin',
    role: 'admin',
  });

  console.log('Creating example users');

  const caffeinatedDuck = await createUser(prisma, auth, {
    email: 'caffeinatedduck@example.com',
    password: 'password1',
    name: 'Caffeinated Duck',
    username: 'CaffeinatedDuck',
  });

  const deepDuckThoughts = await createUser(prisma, auth, {
    email: 'deepduckthoughts@example.com',
    password: 'password2',
    name: 'Deep Duck Thoughts',
    username: 'DeepDuckThoughts',
  });

  const breadCritic = await createUser(prisma, auth, {
    email: 'breadcritic@example.com',
    password: 'password3',
    name: 'The Bread Critic',
    username: 'BreadCritic',
  });

  const migrationSeason = await createUser(prisma, auth, {
    email: 'migrationseason@example.com',
    password: 'password4',
    name: 'Migration Season',
    username: 'MigrationSeason',
  });

  const pondAdmin = await createUser(prisma, auth, {
    email: 'pondadmin@example.com',
    password: 'password5',
    name: 'Pond Admin',
    username: 'PondAdmin',
  });

  console.log('Creating example quacks');

  // Listed oldest first. The feed sorts newest first, so the last entry here is
  // the one at the top of the screen. The mood is optional: some of these have
  // one and some don't, so the feed shows both.
  //
  // Three carry a poll, one in each state worth seeing: ended, open with the
  // defaults for a new poll, and one with a suggestion awaiting approval. A
  // poll's end follows from its length and the quack's age, so the open one
  // must stay less than a day old.
  const exampleQuacks: {
    author: User;
    minutesAgo: number;
    mood?: Mood;
    text: string;
    poll?: {
      length: PollLength;
      results?: PollResultsVisibility;
      suggestions?: PollSuggestionMode;
      options: string[];
      votes?: [User, string][];
      pending?: [User, string][];
    };
  }[] = [
    {
      author: pondAdmin,
      minutesAgo: 2870,
      text: `Reminder: the north end of the pond is closed for reed maintenance until Thursday.
Yes, again. No, we don't know why the contractor is a heron.`,
    },
    {
      author: migrationSeason,
      minutesAgo: 2700,
      text: `The V is voting on the route south. Polls close in an hour.
The front of the V gets one vote, same as everyone else.`,
      // Long over: an hour-long poll from nearly two days back.
      poll: {
        length: '1h',
        options: [
          'Along the coast',
          'Over the mountains',
          'Follow the motorway',
          'Whatever the front decides',
        ],
        votes: [
          [migrationSeason, 'Along the coast'],
          [deepDuckThoughts, 'Along the coast'],
          [breadCritic, 'Follow the motorway'],
          [caffeinatedDuck, 'Over the mountains'],
          [pondAdmin, 'Along the coast'],
        ],
      },
    },
    {
      author: migrationSeason,
      minutesAgo: 2610,
      text: `Left at dawn. 400 km down, 2,600 to go.
The V formation works beautifully right up until whoever is at the front decides to take a shortcut.`,
    },
    {
      author: breadCritic,
      minutesAgo: 2255,
      text: `Sourdough. Thrown by a child. Landed two metres short of anyone.
Crust: excellent. Delivery: amateur. 6/10.`,
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 1980,
      mood: 'silly',
      text: `just spilled coffee on my keyboard
now every time i type "duck" it autocorrects to "quack"
send help or more caffeine`,
    },
    {
      author: deepDuckThoughts,
      minutesAgo: 1495,
      text: `If a pond reflects the sky, is the sky just a very large and very shy pond?`,
    },
    {
      author: migrationSeason,
      minutesAgo: 1240,
      mood: 'angry',
      text: `Update on the shortcut: it added 90 km and one entire mountain.
We are not currently speaking to the front of the V.`,
    },
    {
      author: pondAdmin,
      minutesAgo: 890,
      mood: 'angry',
      text: `Whoever keeps rearranging the stones on the west bank — we see you.
We have footage. It is extremely blurry footage. But we have it.`,
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 640,
      mood: 'silly',
      text: `third espresso and i can hear colours now
one of them is quacking`,
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 560,
      text: `fourth coffee. you pick.
new answers welcome but i'm approving them personally`,
      poll: {
        length: '7d',
        results: 'after_vote',
        suggestions: 'author_approves',
        options: ['espresso', 'double espresso', 'cold brew'],
        votes: [
          [deepDuckThoughts, 'cold brew'],
          [breadCritic, 'double espresso'],
        ],
        pending: [[pondAdmin, 'Water. Please.']],
      },
    },
    {
      author: breadCritic,
      minutesAgo: 415,
      mood: 'happy',
      text: `Multigrain. Seeds still attached. Genuinely nutritious.
The pond is not ready for this level of quality and, frankly, neither am I. 9/10.`,
    },
    {
      author: deepDuckThoughts,
      minutesAgo: 260,
      mood: 'sad',
      text: `Everyone says "water off a duck's back" like it's a compliment.
Some of us would quite like to feel things.`,
    },
    {
      author: pondAdmin,
      minutesAgo: 180,
      text: `Where should the next pond meetup be?
The heron says the north end will be ready by then. The heron has said this before.`,
      // The defaults for a new poll: a day long, results at once, no new
      // answers from others.
      poll: {
        length: '1d',
        options: [
          'North end',
          'West bank, by the stones',
          'The big lily pad',
          'Under the bridge',
        ],
        votes: [
          [caffeinatedDuck, 'The big lily pad'],
          [breadCritic, 'The big lily pad'],
          [deepDuckThoughts, 'Under the bridge'],
          [migrationSeason, 'West bank, by the stones'],
        ],
      },
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 95,
      mood: 'happy',
      text: `me: throws one crumb into the pond
ducks: assemble like the Avengers
i fear i may have started something`,
    },
    {
      author: pondAdmin,
      minutesAgo: 20,
      text: `The bread situation has been resolved. The swan has been spoken to.
Please stop tagging me.`,
    },
  ];

  const now = Date.now();

  for (const { author, minutesAgo, mood, text, poll } of exampleQuacks) {
    const createdAt = new Date(now - minutesAgo * MINUTE_IN_MS);
    const quack = await createQuack(prisma, {
      text,
      mood,
      userId: author.id,
      createdAt,
    });
    if (poll) {
      await addPoll(prisma, {
        quackId: quack.id,
        authorId: author.id,
        createdAt,
        length: poll.length,
        results: poll.results,
        suggestions: poll.suggestions,
        options: poll.options,
        votes: (poll.votes ?? []).map(([voter, option]) => ({
          userId: voter.id,
          option,
        })),
        pending: (poll.pending ?? []).map(([suggester, text]) => ({
          userId: suggester.id,
          text,
        })),
      });
    }
  }
};
