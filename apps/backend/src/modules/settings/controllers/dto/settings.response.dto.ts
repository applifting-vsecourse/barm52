import { Mood, MOODS } from '@/modules/quack/domain/quack';
import { UserSettings } from '@/modules/settings/domain/settings';
import { ApiProperty } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty()
  username!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({ enum: [...MOODS], enumName: 'Mood', nullable: true })
  defaultMood!: Mood | null;

  static fromDomain(settings: UserSettings): SettingsResponseDto {
    return {
      username: settings.username,
      displayName: settings.displayName,
      bio: settings.bio,
      defaultMood: settings.defaultMood,
    };
  }
}
