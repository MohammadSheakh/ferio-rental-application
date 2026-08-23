import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../authentication/auth.module';
import { AuditModule } from '../audit/audit.module';
import { MessageAdapterRegistry } from './adapters/message-adapter.registry';
import { TransactionalMessagingController } from './transactional-messaging.controller';
import { TransactionalMessageDispatcher } from './transactional-message-dispatcher';
import { TransactionalMessageProcessor } from './transactional-message.processor';
import { TransactionalMessageQueue } from './transactional-message.queue';
import { TransactionalMessagingService } from './transactional-messaging.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [TransactionalMessagingController],
  providers: [
    TransactionalMessagingService,
    MessageAdapterRegistry,
    TransactionalMessageDispatcher,
    TransactionalMessageQueue,
    TransactionalMessageProcessor,
  ],
  exports: [TransactionalMessagingService],
})
export class TransactionalMessagingModule {}
