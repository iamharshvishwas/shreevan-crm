import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}
