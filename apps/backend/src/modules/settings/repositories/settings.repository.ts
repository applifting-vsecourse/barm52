import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { UserSettings } from '@/modules/settings/domain/settings';
import { Injectable } from '@nestjs/common';

const SETTINGS_FIELDS = {
  username: true,
  name: true,
  bio: true,
  defaultMood: true,
} satisfies Prisma.UserSelect;

const toSettings = (user: {
  username: string | null;
  name: string;
  bio: string | null;
  defaultMood: UserSettings['defaultMood'];
}): UserSettings => ({
  username: user.username ?? '',
  displayName: user.name,
  bio: user.bio,
  defaultMood: user.defaultMood,
});

export class UsernameTakenError extends Error {
  constructor() {
    super('That username is taken');
  }
}

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string): Promise<UserSettings | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SETTINGS_FIELDS,
    });
    return user ? toSettings(user) : null;
  }

  // Usernames are compared ignoring case, the way BetterAuth's sign-up treats
  // them, so "Duck" and "duck" can't belong to two people.
  async isUsernameTaken(
    username: string,
    exceptUserId: string,
  ): Promise<boolean> {
    const owner = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        id: { not: exceptUserId },
      },
      select: { id: true },
    });
    return owner !== null;
  }

  // The username is stored as typed, in `displayUsername` too, so the app shows
  // exactly what the user chose. The unique index catches a username taken
  // between the check and this write.
  async updateSettings(
    userId: string,
    settings: UserSettings,
  ): Promise<UserSettings> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          username: settings.username,
          displayUsername: settings.username,
          name: settings.displayName,
          bio: settings.bio,
          defaultMood: settings.defaultMood,
        },
        select: SETTINGS_FIELDS,
      });
      return toSettings(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UsernameTakenError();
      }
      throw error;
    }
  }
}
