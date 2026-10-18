// What each reader may see of a poll is decided here, before anything is put in
// a response. A number left in for the wrong reader would reach their browser.
import { Poll, PollOption, toPollView } from './poll';

const NOW = new Date('2026-10-18T12:00:00Z');

const anOption = (overrides: Partial<PollOption> = {}): PollOption => ({
  id: 'o1',
  text: 'Pizza',
  status: 'published',
  position: 0,
  createdById: 'author',
  createdAt: new Date('2026-10-18T10:00:00Z'),
  votes: 0,
  ...overrides,
});

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  quackId: 'q1',
  authorId: 'author',
  endsAt: null,
  resultsVisibility: 'immediately',
  suggestions: 'not_allowed',
  options: [
    anOption({ id: 'o1', text: 'Pizza', position: 0, votes: 2 }),
    anOption({ id: 'o2', text: 'Sushi', position: 1, votes: 1 }),
  ],
  myVoteOptionId: null,
  ...overrides,
});

describe('toPollView', () => {
  it('shows counts and their total to everybody when results show immediately', () => {
    const view = toPollView(aPoll(), 'reader', NOW);

    expect(view.resultsVisible).toBe(true);
    expect(view.options).toEqual([
      { id: 'o1', text: 'Pizza', votes: 2 },
      { id: 'o2', text: 'Sushi', votes: 1 },
    ]);
    expect(view.totalVotes).toBe(3);
  });

  it('keeps the published answers in the order they were published', () => {
    const view = toPollView(
      aPoll({
        options: [
          anOption({ id: 'late', position: 2 }),
          anOption({ id: 'first', position: 0 }),
          anOption({ id: 'second', position: 1 }),
        ],
      }),
      'reader',
      NOW,
    );

    expect(view.options.map((o) => o.id)).toEqual(['first', 'second', 'late']);
  });

  describe('results after voting (X2)', () => {
    const hidden = aPoll({ resultsVisibility: 'after_vote' });

    it('gives a reader who has not voted no numbers at all, not even the total', () => {
      const view = toPollView(hidden, 'reader', NOW);

      expect(view.resultsVisible).toBe(false);
      expect(view.options.map((o) => o.votes)).toEqual([null, null]);
      expect(view.totalVotes).toBeNull();
      expect(JSON.stringify(view)).not.toMatch(/"votes":\d/);
    });

    it('shows the numbers once the reader has voted', () => {
      const view = toPollView(
        { ...hidden, myVoteOptionId: 'o2' },
        'reader',
        NOW,
      );

      expect(view.totalVotes).toBe(3);
      expect(view.myVoteOptionId).toBe('o2');
    });

    it('always shows them to the author', () => {
      expect(toPollView(hidden, 'author', NOW).totalVotes).toBe(3);
    });

    it('shows them to everybody once the poll has ended', () => {
      const ended = { ...hidden, endsAt: new Date('2026-10-18T11:00:00Z') };

      expect(toPollView(ended, 'reader', NOW).totalVotes).toBe(3);
    });
  });

  describe('the end (X1)', () => {
    it('is ended exactly at its end, by the clock it is read with', () => {
      const poll = aPoll({ endsAt: NOW });

      expect(
        toPollView(poll, 'reader', new Date(NOW.getTime() - 1)).ended,
      ).toBe(false);
      expect(toPollView(poll, 'reader', NOW).ended).toBe(true);
    });

    it('never ends without an end', () => {
      expect(toPollView(aPoll(), 'reader', NOW).ended).toBe(false);
    });
  });

  describe('suggestions (X3)', () => {
    const withPending = aPoll({
      suggestions: 'author_approves',
      options: [
        anOption({ id: 'o1', position: 0 }),
        anOption({ id: 'o2', text: 'Sushi', position: 1 }),
        anOption({
          id: 's1',
          text: 'Tacos',
          status: 'pending',
          position: null,
          createdById: 'suggester',
        }),
      ],
    });

    it('shows the author every pending suggestion', () => {
      const view = toPollView(withPending, 'author', NOW);

      expect(view.pendingSuggestions).toEqual([{ id: 's1', text: 'Tacos' }]);
      expect(view.isAuthor).toBe(true);
    });

    it('shows a suggester their own', () => {
      expect(
        toPollView(withPending, 'suggester', NOW).pendingSuggestions,
      ).toEqual([{ id: 's1', text: 'Tacos' }]);
    });

    it('shows nobody else any, and never as an answer to vote for', () => {
      const view = toPollView(withPending, 'reader', NOW);

      expect(view.pendingSuggestions).toEqual([]);
      expect(view.options.map((o) => o.id)).toEqual(['o1', 'o2']);
    });

    it('shows nobody any once the poll has ended', () => {
      const ended = {
        ...withPending,
        endsAt: new Date('2026-10-18T11:00:00Z'),
      };

      expect(toPollView(ended, 'author', NOW).pendingSuggestions).toEqual([]);
      expect(toPollView(ended, 'author', NOW).canSuggest).toBe(false);
    });

    it('offers suggesting while published and pending answers number under ten', () => {
      const nine = Array.from({ length: 9 }, (_, i) =>
        anOption({ id: `o${i}`, text: `${i}`, position: i }),
      );
      const poll = aPoll({ suggestions: 'published', options: nine });

      expect(toPollView(poll, 'reader', NOW).canSuggest).toBe(true);
      const ten = [
        ...nine,
        anOption({ id: 'p', status: 'pending', position: null }),
      ];
      expect(
        toPollView({ ...poll, options: ten }, 'reader', NOW).canSuggest,
      ).toBe(false);
    });

    it('offers it to nobody, the author included, when not allowed', () => {
      expect(toPollView(aPoll(), 'author', NOW).canSuggest).toBe(false);
    });
  });
});
