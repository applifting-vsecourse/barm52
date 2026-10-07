// What counts as a word decides what is a search at all: a query with no words
// is the plain feed, and the plain feed is not logged as a search.
import { searchWords } from './search-words';

describe('searchWords', () => {
  it.each([
    ['bread', ['bread']],
    ['  bread   critic ', ['bread', 'critic']],
    // case is the database's business, so it is kept here
    ['Duck COFFEE', ['Duck', 'COFFEE']],
    ['@caffeinated', ['caffeinated']],
    ['@@caffeinated', ['caffeinated']],
    ['coffee @duck', ['coffee', 'duck']],
    // only a leading @ goes
    ['a@b', ['a@b']],
    ['100%', ['100%']],
  ])('reads %j as %j', (query, words) => {
    expect(searchWords(query)).toEqual(words);
  });

  it.each([undefined, '', '   ', '\t\n', '@', '@@ @', ' @ '])(
    'finds no words in %j',
    (query) => {
      expect(searchWords(query)).toEqual([]);
    },
  );
});
