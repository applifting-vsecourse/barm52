// The rules of a poll that both the DTOs and the services check. The frontend
// mirrors the numbers in its own form schema; the server validates regardless.
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 10;
export const MAX_POLL_OPTION_LENGTH = 80;

export const POLL_LENGTHS = ['1h', '1d', '7d', 'none'] as const;
export type PollLength = (typeof POLL_LENGTHS)[number];

const HOUR_IN_MS = 60 * 60 * 1000;

// How long each length lasts. `none` never ends.
export const POLL_LENGTH_MS: Record<PollLength, number | null> = {
  '1h': HOUR_IN_MS,
  '1d': 24 * HOUR_IN_MS,
  '7d': 7 * 24 * HOUR_IN_MS,
  none: null,
};

export const POLL_RESULTS_VISIBILITIES = ['immediately', 'after_vote'] as const;
export type PollResultsVisibility = (typeof POLL_RESULTS_VISIBILITIES)[number];

export const POLL_SUGGESTION_MODES = [
  'not_allowed',
  'published',
  'author_approves',
] as const;
export type PollSuggestionMode = (typeof POLL_SUGGESTION_MODES)[number];

export type PollOptionStatus = 'published' | 'pending';

// Two answers are the same when they match after trimming, whatever the case.
export const normalizePollOption = (text: string): string =>
  text.trim().toLowerCase();

export type PollOption = {
  id: string;
  text: string;
  status: PollOptionStatus;
  // Order of publication; null while a suggestion waits for approval.
  position: number | null;
  createdById: string;
  createdAt: Date;
  // Users whose current vote is this option.
  votes: number;
};

// A poll as stored, read for one user: `myVoteOptionId` is that user's vote.
export type Poll = {
  quackId: string;
  authorId: string;
  endsAt: Date | null;
  resultsVisibility: PollResultsVisibility;
  suggestions: PollSuggestionMode;
  // Published and pending options alike.
  options: PollOption[];
  myVoteOptionId: string | null;
};

export const isPollEnded = (poll: Pick<Poll, 'endsAt'>, now: Date): boolean =>
  poll.endsAt !== null && poll.endsAt.getTime() <= now.getTime();

// What one user is allowed to see of a poll. Hidden numbers are left out here,
// so they never reach the response, rather than being hidden by the UI.
export type PollView = {
  endsAt: Date | null;
  ended: boolean;
  resultsVisibility: PollResultsVisibility;
  suggestions: PollSuggestionMode;
  isAuthor: boolean;
  resultsVisible: boolean;
  totalVotes: number | null;
  myVoteOptionId: string | null;
  canSuggest: boolean;
  options: { id: string; text: string; votes: number | null }[];
  // The author sees every pending suggestion, a suggester only their own.
  pendingSuggestions: { id: string; text: string }[];
};

export const toPollView = (
  poll: Poll,
  viewerId: string,
  now: Date,
): PollView => {
  const ended = isPollEnded(poll, now);
  const isAuthor = poll.authorId === viewerId;
  const resultsVisible =
    poll.resultsVisibility === 'immediately' ||
    isAuthor ||
    ended ||
    poll.myVoteOptionId !== null;

  const published = poll.options
    .filter((option) => option.status === 'published')
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const pending = ended
    ? []
    : poll.options
        .filter(
          (option) =>
            option.status === 'pending' &&
            (isAuthor || option.createdById === viewerId),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    endsAt: poll.endsAt,
    ended,
    resultsVisibility: poll.resultsVisibility,
    suggestions: poll.suggestions,
    isAuthor,
    resultsVisible,
    totalVotes: resultsVisible
      ? published.reduce((total, option) => total + option.votes, 0)
      : null,
    myVoteOptionId: poll.myVoteOptionId,
    canSuggest:
      poll.suggestions !== 'not_allowed' &&
      !ended &&
      // Pending suggestions take a slot too, so approving one never overflows.
      poll.options.length < MAX_POLL_OPTIONS,
    options: published.map((option) => ({
      id: option.id,
      text: option.text,
      votes: resultsVisible ? option.votes : null,
    })),
    pendingSuggestions: pending.map((option) => ({
      id: option.id,
      text: option.text,
    })),
  };
};
