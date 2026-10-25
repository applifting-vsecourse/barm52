// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

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

describe('QuacksService', () => {
  // A search writes a usage log line. What it says is checked in
  // quacks.search-logging.spec.ts; here it would only be noise.
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks({ id: 'u1' } as Identity)).resolves.toEqual(
      quacks,
    );
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
    expect(repository.getQuacks).toHaveBeenCalledWith([], 'u1', undefined);
  });

  it('narrows the list to the signed-in user for mine', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    const service = new QuacksService(repository);
    await service.getQuacks({ id: 'u1' } as Identity, 'bread', true);

    // the author filter is the session's user, never one the caller names
    expect(repository.getQuacks).toHaveBeenCalledWith(['bread'], 'u1', 'u1');
  });

  it('asks the repository for the words of the search', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    const service = new QuacksService(repository);
    await service.getQuacks({ id: 'u1' } as Identity, '  @Duck   coffee ');

    expect(repository.getQuacks).toHaveBeenCalledWith(
      ['Duck', 'coffee'],
      'u1',
      undefined,
    );
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(service.createQuack(user, { text: 'hello' })).resolves.toEqual(
      created,
    );
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: null,
      userId: 'u1',
    });
  });

  it('creates a quack with a mood', async () => {
    const created = aQuack({ id: 'q3', text: 'grr', mood: 'angry' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(
      service.createQuack(user, { text: 'grr', mood: 'angry' }),
    ).resolves.toEqual(created);
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'grr',
      mood: 'angry',
      userId: 'u1',
    });
  });

  it('stores an explicit null mood as no mood', async () => {
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(aQuack());

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await service.createQuack(user, { text: 'hello', mood: null });

    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: null,
      userId: 'u1',
    });
  });

  describe('deleting a quack', () => {
    it('lets the author delete their own quack', async () => {
      const repository = mock<QuackRepository>();
      repository.getAuthorId.mockResolvedValue('u1');

      const service = new QuacksService(repository);
      await service.deleteQuack({ id: 'u1', role: 'user' } as Identity, 'q1');

      expect(repository.deleteQuack).toHaveBeenCalledWith('q1');
    });

    it("refuses someone else's quack and deletes nothing", async () => {
      const repository = mock<QuackRepository>();
      repository.getAuthorId.mockResolvedValue('u1');

      const service = new QuacksService(repository);

      await expect(
        service.deleteQuack({ id: 'u2', role: 'user' } as Identity, 'q1'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.deleteQuack).not.toHaveBeenCalled();
    });

    it('answers not found for a quack that does not exist', async () => {
      const repository = mock<QuackRepository>();
      repository.getAuthorId.mockResolvedValue(null);

      const service = new QuacksService(repository);

      await expect(
        service.deleteQuack({ id: 'u1', role: 'user' } as Identity, 'gone'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.deleteQuack).not.toHaveBeenCalled();
    });
  });
});
