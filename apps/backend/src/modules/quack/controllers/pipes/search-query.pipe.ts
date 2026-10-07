import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// The longest search the frontend lets a user type.
export const MAX_SEARCH_LENGTH = 100;

// Checks `q`, the one query parameter the list reads. It is a pipe on `q` alone
// rather than a DTO for the whole query string, because the controller's
// validation pipe rejects properties it doesn't know, and the list has always
// ignored any other query parameter.
@Injectable()
export class SearchQueryPipe implements PipeTransform<
  string | undefined,
  string | undefined
> {
  transform(value: string | undefined): string | undefined {
    if (value !== undefined && value.length > MAX_SEARCH_LENGTH) {
      throw new BadRequestException(
        `q must be at most ${MAX_SEARCH_LENGTH} characters`,
      );
    }
    return value;
  }
}
