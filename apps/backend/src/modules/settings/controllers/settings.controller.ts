import { SettingsService } from '@/modules/settings/services/settings.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SettingsResponseDto } from './dto/settings.response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// The signed-in user's own profile settings. There is no user id in the path:
// whose settings these are always comes from the session.
@ApiTags('settings')
@Controller('settings')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Your settings' })
  @ApiResponse({ status: 200, type: SettingsResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async get(@User() user: Identity): Promise<SettingsResponseDto> {
    return SettingsResponseDto.fromDomain(
      await this.settingsService.getSettings(user),
    );
  }

  @Put()
  @ApiOperation({ summary: 'Save your settings' })
  @ApiResponse({ status: 200, type: SettingsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid settings' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 409,
    description:
      'The username belongs to someone else; the body says field "username"',
  })
  async update(
    @User() user: Identity,
    @Body() body: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    return SettingsResponseDto.fromDomain(
      await this.settingsService.updateSettings(user, {
        username: body.username,
        displayName: body.displayName,
        bio: body.bio ?? null,
        defaultMood: body.defaultMood ?? null,
      }),
    );
  }
}
