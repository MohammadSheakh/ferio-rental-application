import { Module, Global } from '@nestjs/common';
import { BullMQQueues } from './bullmq.provider';

/**
 * BullMQ Module
 *
 * 📚 GLOBAL BULLMQ MODULE FOR ASYNC JOB PROCESSING
 */
@Global()
@Module({
  imports: [BullMQQueues],
  exports: [BullMQQueues],
})
export class BullMQModule {}
