// The one list of moods. The DTOs validate against it and the repository maps
// the database enum onto it; the compiler flags any drift from schema.prisma.
export const MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type Mood = (typeof MOODS)[number];

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export type Quack = {
  id: string;
  text: string;
  // Optional for the author, so "no mood" is `null` rather than a missing field.
  mood: Mood | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
};
