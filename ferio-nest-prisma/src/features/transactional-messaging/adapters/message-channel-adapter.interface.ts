import type { CommerceMessageChannel } from '@prisma/client';

export type MessageDispatchInput = {
  recipient: string;
  templateKey: string;
  templateVersion: number;
  subject: string | null;
  body: string;
  payload: unknown;
  idempotencyKey: string;
};

export type MessageDispatchResult = {
  status: 'ACCEPTED' | 'DELIVERED' | 'FAILED' | 'UNKNOWN';
  providerMessageId?: string;
  response?: unknown;
  errorCode?: string;
  errorMessage?: string;
};

export interface MessageChannelAdapter {
  readonly channel: CommerceMessageChannel;
  readonly provider: string;
  isConfigured(): boolean;
  dispatch(input: MessageDispatchInput): Promise<MessageDispatchResult>;
}
