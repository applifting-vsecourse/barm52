import {
  POLL_LENGTH_MS,
  PollLength,
  PollResultsVisibility,
  PollSuggestionMode,
} from '@/modules/quack/domain/poll';
import { Mood, Quack } from '@/modules/quack/domain/quack';
import { searchWords } from '@/modules/quack/domain/search-words';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(private readonly quackRepository: QuackRepository) {}

  // `mine` narrows the list to the signed-in user's own quacks. Who "me" is
  // comes from the session; the request never names a user.
  async getQuacks(
    user: Identity,
    query?: string,
    mine = false,
  ): Promise<Quack[]> {
    const words = searchWords(query);
    if (words.length > 0) {
      // The one record of search use: who searched and when, never what they
      // typed. Product measures distinct users per day from these lines, so
      // keep the event name and the shape stable. It is written before the
      // lookup, so a search that finds nothing, or fails, still counts.
      this.logger.log(
        `quack_search user=${user.id} at=${new Date().toISOString()}`,
      );
    }
    return this.quackRepository.getQuacks(
      words,
      user.id,
      mine ? user.id : undefined,
    );
  }

  // The one place that decides who may delete a quack. Hiding the button in
  // the UI is a convenience; this check is what keeps a direct API call out.
  async deleteQuack(user: Identity, quackId: string): Promise<void> {
    const authorId = await this.quackRepository.getAuthorId(quackId);
    if (authorId === null) throw new NotFoundException('Quack not found');

    const isOwner = authorId === user.id;
    if (!isOwner) {
      throw new ForbiddenException('You can only delete your own quacks');
    }

    await this.quackRepository.deleteQuack(quackId);
  }

  async createQuack(
    user: Identity,
    quackData: {
      text: string;
      mood?: Mood | null;
      poll?: {
        options: string[];
        length?: PollLength;
        results?: PollResultsVisibility;
        suggestions?: PollSuggestionMode;
      } | null;
    },
  ): Promise<Quack> {
    const { poll } = quackData;
    const quack = await this.quackRepository.createQuack({
      text: quackData.text,
      // a quack without a mood is stored as null, whether the field was left
      // out or sent as null
      mood: quackData.mood ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
      // A setting left out takes its least restrictive value: no end, results
      // at once, no suggestions. The form always sends all three.
      poll: poll
        ? {
            options: poll.options.map((option) => option.trim()),
            endsAt: endOfPoll(poll.length ?? 'none', new Date()),
            resultsVisibility: poll.results ?? 'immediately',
            suggestions: poll.suggestions ?? 'not_allowed',
          }
        : undefined,
    });
    if (quack.poll) {
      // Same shape as quack_search, written only once the poll is stored.
      // Never the question or the answers.
      this.logger.log(
        `poll_created user=${user.id} poll=${quack.id} at=${new Date().toISOString()}`,
      );
    }
    return quack;
  }
}

// The end is computed here, from the server's clock; the client never sends one.
const endOfPoll = (length: PollLength, createdAt: Date): Date | null => {
  const duration = POLL_LENGTH_MS[length];
  return duration === null ? null : new Date(createdAt.getTime() + duration);
};
