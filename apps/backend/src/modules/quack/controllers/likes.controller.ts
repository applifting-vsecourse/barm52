import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Controller,
  Delete,
  NotImplementedException,
  Put,
  UseGuards,
} from '@nestjs/common';

@Controller('quacks/:id/like')
@UseGuards(AuthenticatedUserGuard)
export class LikesController {
  @Put()
  like(): never {
    throw new NotImplementedException('not implemented');
  }

  @Delete()
  unlike(): never {
    throw new NotImplementedException('not implemented');
  }
}
