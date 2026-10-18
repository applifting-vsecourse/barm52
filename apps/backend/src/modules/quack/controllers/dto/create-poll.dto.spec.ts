// A poll enters the system only through the quack's request body, so this is
// where a bad one is turned away (A4), with the same options as the pipe.
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateQuackDto } from './create-quack.dto';

const errorsFor = async (body: object): Promise<ValidationError[]> =>
  validate(plainToInstance(CreateQuackDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const messages = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);

const withPoll = (poll: unknown): object => ({ text: 'Lunch?', poll });

describe('CreateQuackDto with a poll', () => {
  it('accepts a quack without a poll, or with a null one, as before', async () => {
    await expect(errorsFor({ text: 'hello' })).resolves.toEqual([]);
    await expect(errorsFor({ text: 'hello', poll: null })).resolves.toEqual([]);
  });

  it('accepts two answers with every setting', async () => {
    await expect(
      errorsFor(
        withPoll({
          options: ['Pizza', 'Sushi'],
          length: '1d',
          results: 'after_vote',
          suggestions: 'author_approves',
        }),
      ),
    ).resolves.toEqual([]);
  });

  it('accepts ten answers of 80 characters', async () => {
    const options = Array.from({ length: 10 }, (_, i) =>
      `${i}`.padEnd(80, 'x'),
    );
    await expect(errorsFor(withPoll({ options }))).resolves.toEqual([]);
  });

  it.each([
    ['one answer', ['Pizza']],
    ['eleven answers', Array.from({ length: 11 }, (_, i) => `${i}`)],
    ['an answer of 81 characters', ['Pizza', 'x'.repeat(81)]],
    ['no answers', []],
  ])('rejects %s', async (_case, options) => {
    expect((await errorsFor(withPoll({ options }))).length).toBeGreaterThan(0);
  });

  it('rejects a blank answer instead of dropping it', async () => {
    const errors = await errorsFor(withPoll({ options: ['Pizza', '   '] }));

    expect(messages(errors)).toContain('Fill in or remove this option');
  });

  it('rejects answers that differ only in case and spaces', async () => {
    const errors = await errorsFor(withPoll({ options: ['Pizza', ' pIZZA '] }));

    expect(messages(errors)).toContain('Answers must be different');
  });

  it.each([
    ['an unknown length', { length: '2d' }],
    ['an unknown results setting', { results: 'never' }],
    ['an unknown suggestions setting', { suggestions: 'yes' }],
    ['an unknown field', { endsAt: '2030-01-01T00:00:00Z' }],
  ])('rejects %s', async (_case, extra) => {
    const errors = await errorsFor(
      withPoll({ options: ['Pizza', 'Sushi'], ...extra }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    ['a string', 'Pizza,Sushi'],
    ['a list', ['Pizza', 'Sushi']],
  ])('rejects a poll that is %s', async (_case, poll) => {
    expect((await errorsFor(withPoll(poll))).length).toBeGreaterThan(0);
  });
});
