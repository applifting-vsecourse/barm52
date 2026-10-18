import { UserSettings } from '@/modules/settings/domain/settings';
import {
  SettingsRepository,
  UsernameTakenError,
} from '@/modules/settings/repositories/settings.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

// The client puts this message under the username field, by `field`.
const usernameTaken = (): ConflictException =>
  new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    message: 'That username is taken',
    field: 'username',
  });

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getSettings(user: Identity): Promise<UserSettings> {
    const settings = await this.settingsRepository.getSettings(user.id);
    if (!settings) throw new NotFoundException('User not found');
    return settings;
  }

  // Always the signed-in user's own settings: the id comes from the session.
  async updateSettings(
    user: Identity,
    input: UserSettings,
  ): Promise<UserSettings> {
    const settings: UserSettings = {
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      // An empty bio is no bio.
      bio: input.bio?.trim() || null,
      defaultMood: input.defaultMood ?? null,
    };
    if (
      await this.settingsRepository.isUsernameTaken(settings.username, user.id)
    ) {
      throw usernameTaken();
    }
    try {
      return await this.settingsRepository.updateSettings(user.id, settings);
    } catch (error) {
      if (error instanceof UsernameTakenError) throw usernameTaken();
      throw error;
    }
  }
}
