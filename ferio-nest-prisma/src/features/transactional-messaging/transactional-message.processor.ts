import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '@app/queue';
import { runWithCorrelationId } from '@app/common';
import { TransactionalMessageDispatcher } from './transactional-message-dispatcher';
import {
  TRANSACTIONAL_MESSAGE_JOB,
  TRANSACTIONAL_MESSAGE_SWEEP_JOB,
  TransactionalMessageJobData,
  TransactionalMessageQueue,
} from './transactional-message.queue';

@Processor(QUEUE_NAMES.TRANSACTIONAL_MESSAGE)
export class TransactionalMessageProcessor extends WorkerHost {
  constructor(
    private readonly dispatcher: TransactionalMessageDispatcher,
    private readonly queue: TransactionalMessageQueue,
  ) {
    super();
  }

  process(job: Job<TransactionalMessageJobData>) {
    return runWithCorrelationId(`queue:${job.name}:${String(job.id)}`, () => {
      if (job.name === TRANSACTIONAL_MESSAGE_SWEEP_JOB)
        return this.queue.enqueueDue();
      if (job.name !== TRANSACTIONAL_MESSAGE_JOB || !job.data.messageId) {
        throw new Error(`Unsupported transactional message job: ${job.name}`);
      }
      return this.dispatcher.execute(job.data.messageId);
    });
  }
}
