import { Mood } from '@/modules/quack/domain/quack';

// The rules both the DTO and the frontend form apply. The username rules are
// BetterAuth's (the username plugin's defaults), so a username chosen here is
// one sign-up would have accepted too.
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 160;

export type UserSettings = {
  username: string;
  // Shown on every quack and in the header; stored as the user's `name`.
  displayName: string;
  // Null when the user wrote none.
  bio: string | null;
  // Preselected in the new-quack form; null for no mood.
  defaultMood: Mood | null;
};
