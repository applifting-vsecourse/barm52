import { LikeSummary } from '@/modules/quack/domain/like';
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
  BadRequestException,
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
    // Without mine the repository is called exactly as before the tabs.
    return mine
      ? this.quackRepository.getQuacks(words, user.id, user.id)
      : this.quackRepository.getQuacks(words, user.id);
  }

  // The one place that decides who may delete a quack: its author, or a
  // moderator (the admin role). Both come from the session, never from the
  // request. Hiding the button in the UI is a convenience; this check is what
  // keeps a direct API call out.
  async deleteQuack(user: Identity, quackId: string): Promise<void> {
    const quack = await this.quackRepository.getQuackState(quackId);
    // A placeholder's content is already gone; there is nothing left to delete.
    if (!quack || quack.deleted) throw quackNotFound();

    const isOwner = quack.authorId === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You can only delete your own quacks');
    }

    await this.quackRepository.deleteQuack(quackId);
  }

  async setLike(
    user: Identity,
    quackId: string,
    liked: boolean,
  ): Promise<LikeSummary> {
    const summary = await this.quackRepository.setLike(quackId, user.id, liked);
    if (!summary) throw quackNotFound();
    return summary;
  }

  async getReplies(quackId: string, viewerId: string): Promise<Quack[]> {
    const quack = await this.quackRepository.getQuackState(quackId);
    if (!quack) throw quackNotFound();
    return this.quackRepository.getReplies(quackId, viewerId);
  }

  // Replies go one level deep: only a top-level quack that hasn't been deleted
  // takes them. The author is the session's user, as for any quack.
  async createReply(
    user: Identity,
    quackId: string,
    text: string,
  ): Promise<Quack> {
    const parent = await this.quackRepository.getQuackState(quackId);
    if (!parent || parent.deleted) throw quackNotFound();
    if (parent.parentId !== null) {
      throw new BadRequestException('You can only reply to a top-level quack');
    }
    return this.quackRepository.createReply({
      parentId: quackId,
      userId: user.id,
      text,
    });
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

const quackNotFound = (): NotFoundException =>
  new NotFoundException('Quack not found');

// The end is computed here, from the server's clock; the client never sends one.
const endOfPoll = (length: PollLength, createdAt: Date): Date | null => {
  const duration = POLL_LENGTH_MS[length];
  return duration === null ? null : new Date(createdAt.getTime() + duration);
};
