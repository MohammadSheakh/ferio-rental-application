import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AuthGuard,
  PERMISSIONS,
  Permissions,
  PermissionsGuard,
  Roles,
  RolesGuard,
  User,
} from '@app/common';
import type { UserPayload } from '@app/common';
import {
  TransactionalMessageQueryDto,
  UpdateMessageTemplateDto,
  UpdateMessagingPolicyDto,
} from './dto/transactional-message.dto';
import { TransactionalMessagingService } from './transactional-messaging.service';
import { TransactionalMessageQueue } from './transactional-message.queue';

@ApiTags('Admin Transactional Messages')
@ApiBearerAuth()
@Controller('admin/transactional-messages')
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
@Permissions(PERMISSIONS.MESSAGING_READ)
export class TransactionalMessagingController {
  constructor(
    private readonly messages: TransactionalMessagingService,
    private readonly queue: TransactionalMessageQueue,
  ) {}

  @Get()
  getMessages(@Query() query: TransactionalMessageQueryDto) {
    return this.messages.getMessages(query);
  }

  @Get('policy')
  getPolicy() {
    return this.messages.getPolicy();
  }

  @Get('templates')
  getTemplates() {
    return this.messages.getTemplates();
  }

  @Patch('templates/:key')
  @Permissions(PERMISSIONS.MESSAGING_MANAGE)
  updateTemplate(
    @Param('key') key: string,
    @Body() dto: UpdateMessageTemplateDto,
    @User() actor: UserPayload,
  ) {
    return this.messages.updateTemplate(key, dto, actor);
  }

  @Patch('policy')
  @Permissions(PERMISSIONS.MESSAGING_MANAGE)
  updatePolicy(
    @Body() dto: UpdateMessagingPolicyDto,
    @User() actor: UserPayload,
  ) {
    return this.messages.updatePolicy(dto, actor);
  }

  @Get('queue-health')
  queueHealth() {
    return this.queue.health();
  }

  @Post(':id/retry')
  @Permissions(PERMISSIONS.MESSAGING_MANAGE)
  retry(@Param('id') id: string, @User() actor: UserPayload) {
    return this.queue.retry(id, actor);
  }
}
