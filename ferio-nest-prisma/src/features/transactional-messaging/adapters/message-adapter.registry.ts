import { Injectable } from '@nestjs/common';
import type { CommerceMessageChannel } from '@prisma/client';
import type {
  MessageChannelAdapter,
  MessageDispatchInput,
  MessageDispatchResult,
} from './message-channel-adapter.interface';

@Injectable()
export class MessageAdapterRegistry {
  private readonly adapters = new Map<
    CommerceMessageChannel,
    MessageChannelAdapter
  >();

  register(adapter: MessageChannelAdapter) {
    this.adapters.set(adapter.channel, adapter);
  }

  readiness() {
    return (['WHATSAPP', 'SMS', 'EMAIL'] as CommerceMessageChannel[]).map(
      (channel) => {
        const adapter = this.adapters.get(channel);
        return {
          channel,
          provider: adapter?.provider ?? null,
          configured: adapter?.isConfigured() ?? false,
        };
      },
    );
  }

  isConfigured(channel: CommerceMessageChannel) {
    return this.adapters.get(channel)?.isConfigured() ?? false;
  }

  async dispatch(
    channel: CommerceMessageChannel,
    input: MessageDispatchInput,
  ): Promise<MessageDispatchResult> {
    const adapter = this.adapters.get(channel);
    if (!adapter?.isConfigured()) {
      return {
        status: 'FAILED',
        errorCode: 'CHANNEL_NOT_CONFIGURED',
        errorMessage: `${channel} does not have an approved provider adapter`,
      };
    }
    return adapter.dispatch(input);
  }
}
