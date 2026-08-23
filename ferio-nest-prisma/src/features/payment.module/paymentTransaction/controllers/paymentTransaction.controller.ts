import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,   
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreatePaymentTransactionDto, QueryPaymentTransactionDto, UpdatePaymentStatusDto } from "../dto/paymentTransaction.dto";
import { PaymentTransactionService } from "../services/paymentTransaction.service";
import { AuthGuard, RolesGuard, Roles } from '@app/common';

/**
 * PaymentTransaction Controller
 * Handles all payment transaction operations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Controller('payment-transactions')
@ApiTags('Payment Transactions')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
export class PaymentTransactionController {
  constructor(private readonly paymentTransactionService: PaymentTransactionService) {}

  /**
   * Get all payment transactions (Admin only)
   */
  @Get()
  @ApiOperation({
    summary: 'Get all payment transactions',
    description: 'Get all payment transactions with pagination and filters (Admin only)',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'completed', 'failed', 'refunded'] })
  @ApiQuery({ name: 'gateway', required: false, enum: ['stripe', 'paypal', 'sslcommerz', 'revenuecat'] })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @Roles('admin')
  @Throttle(100, 60)
  async getAll(
    @Query() query: QueryPaymentTransactionDto,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('sortBy') sortBy?: string,
  ) {
    const result = await this.paymentTransactionService.getAllWithPagination(
      query,
      { page, limit, sortBy },
      [{ path: 'userId', select: 'name email role' }],
      '-isDeleted -gatewayResponse',
    );

    return {
      success: true,
      data: result,
      message: 'Payment transactions retrieved successfully',
    };
  }

  /**
   * Get all transactions for debug (with full gateway response)
   */
  @Get('debug')
  @ApiOperation({
    summary: 'Get all transactions (debug)',
    description: 'Get all transactions with full gateway response for debugging (Admin only)',
  })
  @Roles('admin')
  @Throttle(100, 60)
  async getAllForDebug(
    @Query() query: QueryPaymentTransactionDto,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const result = await this.paymentTransactionService.getAllWithPagination(
      query,
      { page, limit, sortBy: '-createdAt' },
      [],
      '-isDeleted',
    );

    return {
      success: true,
      data: result,
      message: 'Payment transactions retrieved successfully (debug mode)',
    };
  }

  /**
   * Get earnings overview (Admin only)
   */
  @Get('earnings/overview')
  @ApiOperation({
    summary: 'Get earnings overview',
    description: 'Get comprehensive earnings overview with statistics (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Earnings overview retrieved successfully' })
  @Roles('admin')
  @Throttle(10, 60) // 10 requests per minute (heavy aggregation)
  async getEarningsOverview() {
    const result = await this.paymentTransactionService.getEarningsOverview();

    return {
      success: true,
      data: result,
      message: 'Earnings overview retrieved successfully',
    };
  }

  /**
   * Get user's payment transactions
   */
  @Get('user/:userId')
  @ApiOperation({
    summary: "Get user's payment transactions",
    description: "Get all payment transactions for a specific user",
  })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @Throttle(100, 60)
  async findByUser(@Param('userId') userId: string) {
    const result = await this.paymentTransactionService.findByUserId(userId);

    return {
      success: true,
      data: result,
      message: 'User payment transactions retrieved successfully',
    };
  }

  /**
   * Get transaction by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Get a specific payment transaction by ID',
  })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Throttle(100, 60)
  async findById(@Param('id') id: string) {
    const result = await this.paymentTransactionService.findById(id);

    if (!result) {
      return {
        success: false,
        message: 'Transaction not found',
      };
    }

    return {
      success: true,
      data: result,
      message: 'Transaction retrieved successfully',
    };
  }

  /**
   * Create a new payment transaction
   */
  @Post()
  @ApiOperation({
    summary: 'Create payment transaction',
    description: 'Create a new payment transaction record',
  })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @Roles('admin')
  @Throttle(30, 60)
  async create(@Body() createDto: CreatePaymentTransactionDto) {
    const result = await this.paymentTransactionService.create(createDto);

    return {
      success: true,
      data: result,
      message: 'Payment transaction created successfully',
    };
  }

  /**
   * Update payment status
   */
  @Put(':id/status')
  @ApiOperation({
    summary: 'Update payment status',
    description: 'Update the status of a payment transaction',
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Roles('admin')
  @Throttle(30, 60)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdatePaymentStatusDto,
  ) {
    const result = await this.paymentTransactionService.updateStatus(
      id,
      updateDto.status,
      updateDto.gatewayResponse,
    );

    return {
      success: true,
      data: result,
      message: 'Payment status updated successfully',
    };
  }

  /**
   * Delete transaction (soft delete, admin only)
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete transaction',
    description: 'Soft delete a payment transaction (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @Roles('admin')
  @Throttle(10, 60)
  async delete(@Param('id') id: string) {
    const result = await this.paymentTransactionService.delete(id);

    return {
      success: true,
      data: result,
      message: 'Transaction deleted successfully',
    };
  }
}
