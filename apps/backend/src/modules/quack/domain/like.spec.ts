import { toLikeSummary } from './like';

describe('like summaries', () => {
  it('U1: shares the count and shows only the current viewer’s like', () => {
    expect(toLikeSummary(false, 2, true)).toEqual({
      count: 2,
      likedByMe: true,
    });
    expect(toLikeSummary(false, 2, false)).toEqual({
      count: 2,
      likedByMe: false,
    });
  });

  it('U2: hides the like summary on a deleted quack', () => {
    expect(toLikeSummary(true, 2, true)).toBeNull();
  });
});
