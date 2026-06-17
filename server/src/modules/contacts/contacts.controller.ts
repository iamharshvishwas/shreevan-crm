import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { AddIdentityDto, ListContactsDto, ReviewMergeDto } from './dto/contacts.dto';
import { CurrentUser } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Query() dto: ListContactsDto) {
    return this.contacts.list(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contacts.get(id);
  }

  @Post(':id/identities')
  addIdentity(@Param('id') id: string, @Body() dto: AddIdentityDto) {
    return this.contacts.addIdentity(id, dto.channel, dto.handle, dto.displayName);
  }

  @Get(':id/merge-suggestions')
  suggestions(@Param('id') id: string) {
    return this.contacts.mergeSuggestions(id);
  }

  @Post('merge-suggestions/:suggestionId/review')
  review(
    @Param('suggestionId') suggestionId: string,
    @Body() dto: ReviewMergeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contacts.reviewMerge(suggestionId, dto.decision, user.id);
  }
}
