// `mine` is a yes/no switch. Anything else is turned away rather than read as
// "no", so a typo doesn't quietly show the whole feed.
import { BadRequestException } from '@nestjs/common';
import { MineQueryPipe } from './mine-query.pipe';

describe('MineQueryPipe', () => {
  const pipe = new MineQueryPipe();

  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
  ])('reads mine=%j as %j', (value, expected) => {
    expect(pipe.transform(value)).toBe(expected);
  });

  it.each(['', '1', 'yes', 'TRUE', 'u1'])('rejects mine=%j', (value) => {
    expect(() => pipe.transform(value)).toThrow(BadRequestException);
  });
});
