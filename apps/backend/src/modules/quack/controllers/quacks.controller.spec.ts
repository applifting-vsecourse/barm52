// The controller is where the request body meets the service. It is the one link
// where a mood could be dropped without any other spec noticing: the DTO,
// service and repository specs each pass on their own, and the compiler accepts
// a create that leaves an optional field out.
import { Quack } from '@/modules/quack/domain/quack';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { QuacksController } from './quacks.controller';

// The guard pulls in BetterAuth, which a unit test of the controller has no use for.
jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

describe('QuacksController', () => {
  it('hands the mood from the request body to the service and returns it', async () => {
    const service = mock<QuacksService>();
    service.createQuack.mockResolvedValue(
      aQuack({ text: 'grr', mood: 'angry' }),
    );
    const user = { id: 'u1' } as Identity;

    const created = await new QuacksController(service).create(user, {
      text: 'grr',
      mood: 'angry',
    });

    expect(service.createQuack).toHaveBeenCalledWith(user, {
      text: 'grr',
      mood: 'angry',
    });
    expect(created.mood).toBe('angry');
  });

  it('lists every quack with its mood, null when it has none', async () => {
    const service = mock<QuacksService>();
    service.getQuacks.mockResolvedValue([
      aQuack({ id: 'q2', mood: 'sad' }),
      aQuack({ id: 'q1', mood: null }),
    ]);

    const quacks = await new QuacksController(service).list();

    expect(quacks.map(({ id, mood }) => ({ id, mood }))).toEqual([
      { id: 'q2', mood: 'sad' },
      { id: 'q1', mood: null },
    ]);
  });
});
