import { ForbiddenException } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';

describe('MarketplaceController identity binding', () => {
  const accountService = {
    getAccountByCentralUserId: jest.fn(),
    createAccount: jest.fn(),
  };
  const listingService = { createListing: jest.fn() };
  const interactionService = {};

  let controller: MarketplaceController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MarketplaceController(
      accountService as any,
      listingService as any,
      interactionService as any,
    );
  });

  it('rejects a path account that does not belong to the JWT identity', async () => {
    accountService.getAccountByCentralUserId.mockResolvedValue({ id: 'account-owner' });

    await expect(
      controller.createListing(
        'account-victim',
        { userId: 'central-owner' },
        {} as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(listingService.createListing).not.toHaveBeenCalled();
  });

  it('ignores a spoofed central user id when creating an account', async () => {
    await expect(
      controller.createAccount(
        { userId: 'central-owner' },
        { centralUserId: 'central-victim', displayName: 'Owner' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accountService.createAccount).not.toHaveBeenCalled();
  });
});
