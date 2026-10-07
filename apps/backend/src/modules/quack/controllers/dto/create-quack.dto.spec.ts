// The request body is the only place a mood enters the system, so this is where
// a bad one has to be turned away.
import { MOODS } from '@/modules/quack/domain/quack';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuackDto } from './create-quack.dto';

// Same options as the ValidationPipe on QuacksController.
const invalidProperties = async (body: object): Promise<string[]> => {
  const errors = await validate(plainToInstance(CreateQuackDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
};

describe('CreateQuackDto', () => {
  it('accepts a quack without a mood', async () => {
    await expect(invalidProperties({ text: 'hello' })).resolves.toEqual([]);
  });

  it('accepts a null mood as no mood', async () => {
    await expect(
      invalidProperties({ text: 'hello', mood: null }),
    ).resolves.toEqual([]);
  });

  it.each(MOODS)('accepts the %s mood', async (mood) => {
    await expect(invalidProperties({ text: 'hello', mood })).resolves.toEqual(
      [],
    );
  });

  // '' is not "no mood" (that is null or absent), and the check is case-sensitive.
  it.each(['ecstatic', 'Happy', '', 1])('rejects the mood %j', async (mood) => {
    await expect(invalidProperties({ text: 'hello', mood })).resolves.toEqual([
      'mood',
    ]);
  });
});
