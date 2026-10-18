// Prisma is faked, the repository is real: this is where "unique ignoring case"
// and "taken between check and save" turn into queries and errors.
import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { SettingsRepository, UsernameTakenError } from './settings.repository';

describe('SettingsRepository', () => {
  const user = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const repository = new SettingsRepository({
    user,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('looks for the username ignoring case, among other users only', async () => {
    user.findFirst.mockResolvedValue({ id: 'u2' });

    await expect(repository.isUsernameTaken('Duck', 'u1')).resolves.toBe(true);
    expect(user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          username: { equals: 'Duck', mode: 'insensitive' },
          id: { not: 'u1' },
        },
      }),
    );
  });

  it('finds a username free when nobody else has it', async () => {
    user.findFirst.mockResolvedValue(null);

    await expect(repository.isUsernameTaken('Duck', 'u1')).resolves.toBe(false);
  });

  it('writes the username as typed, as the display username too, and every setting', async () => {
    user.update.mockResolvedValue({
      username: 'Duck',
      name: 'A Duck',
      bio: null,
      defaultMood: 'happy',
    });

    const saved = await repository.updateSettings('u1', {
      username: 'Duck',
      displayName: 'A Duck',
      bio: null,
      defaultMood: 'happy',
    });

    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: {
          username: 'Duck',
          displayUsername: 'Duck',
          name: 'A Duck',
          bio: null,
          defaultMood: 'happy',
        },
      }),
    );
    expect(saved).toEqual({
      username: 'Duck',
      displayName: 'A Duck',
      bio: null,
      defaultMood: 'happy',
    });
  });

  it('turns a unique-index violation into UsernameTakenError', async () => {
    user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      repository.updateSettings('u1', {
        username: 'Duck',
        displayName: 'A Duck',
        bio: null,
        defaultMood: null,
      }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it('reads the settings of a user', async () => {
    user.findUnique.mockResolvedValue({
      username: 'Duck',
      name: 'A Duck',
      bio: 'Hi',
      defaultMood: null,
    });

    await expect(repository.getSettings('u1')).resolves.toEqual({
      username: 'Duck',
      displayName: 'A Duck',
      bio: 'Hi',
      defaultMood: null,
    });
  });
});
