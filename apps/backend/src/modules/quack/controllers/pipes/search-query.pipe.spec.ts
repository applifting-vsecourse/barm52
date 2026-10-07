// 100 characters is the most the search field lets a user type, so anything
// longer is turned away here.
import { BadRequestException } from '@nestjs/common';
import { MAX_SEARCH_LENGTH, SearchQueryPipe } from './search-query.pipe';

describe('SearchQueryPipe', () => {
  const pipe = new SearchQueryPipe();

  it.each([undefined, '', 'bread', 'a'.repeat(MAX_SEARCH_LENGTH)])(
    'lets the search %j through',
    (q) => {
      expect(pipe.transform(q)).toBe(q);
    },
  );

  it('rejects a search of 101 characters', () => {
    expect(() => pipe.transform('a'.repeat(MAX_SEARCH_LENGTH + 1))).toThrow(
      BadRequestException,
    );
  });
});
