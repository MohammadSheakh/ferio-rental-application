import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalBillingService } from '../services/rental-billing.service';
import { CreateRentalInvoiceDto, RecordPaymentDto, VerifyCashPaymentDto, RecordDepositTransactionDto } from '../dto/rental-billing.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Billing, Invoices & Ledger')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/billing')
export class RentalBillingController {
  constructor(private readonly billingService: RentalBillingService) {}

  @Post('invoices')
  @ApiOperation({ summary: 'Issue an invoice for rent, service charges, or utilities' })
  async createInvoice(@Body() createDto: CreateRentalInvoiceDto) {
    const data = await this.billingService.createInvoice(createDto);
    return {
      success: true,
      message: `Invoice '${data.invoiceNumber}' issued successfully.`,
      data,
    };
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment (Cash, bKash, Nagad, Bank Transfer) and post to ledger' })
  async recordPayment(@Body() recordDto: RecordPaymentDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.billingService.recordPayment(recordDto, userId);
    return {
      success: true,
      message: `Payment '${data.paymentNumber}' recorded successfully.`,
      data,
    };
  }

  @Get('payments/pending-cash')
  @ApiOperation({ summary: 'Get all pending cash payments requiring Maker/Checker verification' })
  async getPendingCashPayments(@Query('organizationId') organizationId: string) {
    const data = await this.billingService.getPendingCashPayments(organizationId);
    return {
      success: true,
      data,
    };
  }

  @Patch('payments/:id/verify-cash')
  @ApiOperation({ summary: 'Maker/Checker Cash Verification: Approve or Reject collected cash' })
  async verifyCashPayment(
    @Param('id') id: string,
    @Body() dto: VerifyCashPaymentDto,
    @Request() req: any,
  ) {
    const verifierUserId = req.user?.id || req.user?.sub;
    const data = await this.billingService.verifyCashPayment(id, verifierUserId, dto.approved);
    return {
      success: true,
      message: `Cash Payment verification status set to ${data.verificationStatus}.`,
      data,
    };
  }

  @Post('deposits/transactions')
  @ApiOperation({ summary: 'Record Security Deposit escrow transaction (Collection, Deduction, Refund)' })
  async recordDepositTransaction(@Body() dto: RecordDepositTransactionDto) {
    const data = await this.billingService.recordDepositTransaction(dto);
    return {
      success: true,
      message: `Deposit transaction '${dto.type}' recorded successfully.`,
      data,
    };
  }

  @Get('ledger/:billingAccountId')
  @ApiOperation({ summary: 'Get complete double-entry ledger statement for a tenant billing account' })
  async getTenantLedger(@Param('billingAccountId') billingAccountId: string) {
    const data = await this.billingService.getTenantLedger(billingAccountId);
    return {
      success: true,
      data,
    };
  }
}
