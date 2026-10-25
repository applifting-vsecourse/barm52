import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// Checks `mine`, the switch between the whole feed and the signed-in user's own
// quacks. Like `q` it is a pipe on the one parameter, so every other query
// parameter stays as ignored as it always was. It is a yes/no switch, never a
// user id: whose quacks are "mine" comes from the session.
@Injectable()
export class MineQueryPipe implements PipeTransform<
  string | undefined,
  boolean
> {
  transform(value: string | undefined): boolean {
    if (value === undefined || value === 'false') return false;
    if (value === 'true') return true;
    throw new BadRequestException('mine must be true or false');
  }
}
