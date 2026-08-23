import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
//@ts-ignore
import { InjectModel } from '@nestjs/mongoose';
//@ts-ignore
import { Model, Types } from 'mongoose';
//@ts-ignore
import { PaymentTransaction, PaymentTransactionDocument } from './schemas/paymentTransaction.schema';
import { PaymentStatus, PaymentGateway, PAYMENT_CACHE_CONFIG } from './constants/payment.constants';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { QueryPaymentTransactionDto } from './dto/paymentTransaction.dto';

/**
 * PaymentTransaction Service
 * Handles all payment transaction operations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private paymentTransactionModel: Model<PaymentTransactionDocument>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Get cache key
   */
  private getCacheKey(type: string, userId?: string, transactionId?: string): string {
    const prefix = PAYMENT_CACHE_CONFIG.PREFIX;
    if (type === 'detail' && transactionId) {
      return `${prefix}:transaction:${transactionId}`;
    }
    if (type === 'user' && userId) {
      return `${prefix}:user:${userId}`;
    }
    if (type === 'earnings') {
      return `${prefix}:earnings:summary`;
    }
    return `${prefix}:unknown`;
  }

  /**
   * Get from cache
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cacheManager.get<T>(key);
      if (cached) {
        this.logger.debug(`Cache HIT: ${key}`);
        return cached;
      }
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache GET error: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Set in cache
   */
  private async setInCache<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      await this.cacheManager.set(key, data, ttl * 1000);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error: ${error.message}`, error.stack);
    }
  }

  /**
   * Invalidate cache
   */
  private async invalidateCache(userId?: string, transactionId?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];
      if (transactionId) {
        keysToDelete.push(this.getCacheKey('detail', undefined, transactionId));
      }
      if (userId) {
        keysToDelete.push(this.getCacheKey('user', userId));
      }
      keysToDelete.push(this.getCacheKey('earnings'));

      await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
      this.logger.log(`Invalidated ${keysToDelete.length} cache keys`);
    } catch (error) {
      this.logger.error(`Cache invalidation error: ${error.message}`, error.stack);
    }
  }

  /**
   * Create a new payment transaction
   */
  async create(createDto: any): Promise<PaymentTransactionDocument> {
    this.logger.log(`Creating payment transaction for user ${createDto.userId}`);

    const transaction = await this.paymentTransactionModel.create(createDto);

    // Invalidate cache
    await this.invalidateCache(createDto.userId, transaction._id.toString());

    this.logger.log(`Created transaction: ${transaction._id}`);
    return transaction;
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<PaymentTransactionDocument | null> {
    const cacheKey = this.getCacheKey('detail', undefined, id);

    // Try cache first
    const cached = await this.getFromCache<PaymentTransactionDocument>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database
    const transaction = await this.paymentTransactionModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .populate('userId', 'name email')
      .lean();

    // Cache the result
    if (transaction) {
      await this.setInCache(cacheKey, transaction, PAYMENT_CACHE_CONFIG.TRANSACTION_DETAIL_TTL);
    }

    return transaction;
  }

  /**
   * Find transaction by RevenueCat order ID (idempotency check)
   */
  async findByRevenueCatOrderId(orderId: string): Promise<PaymentTransactionDocument | null> {
    return this.paymentTransactionModel.findOne({
      revenueCatOrderId: orderId,
      isDeleted: false,
    });
  }

  /**
   * Get all transactions for a user
   */
  async findByUserId(userId: string): Promise<PaymentTransactionDocument[]> {
    const cacheKey = this.getCacheKey('user', userId);

    // Try cache first
    const cached = await this.getFromCache<PaymentTransactionDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database
    const transactions = await this.paymentTransactionModel
      .find({ userId: new Types.ObjectId(userId), isDeleted: false })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .lean();

    // Cache the result
    if (transactions) {
      await this.setInCache(cacheKey, transactions, PAYMENT_CACHE_CONFIG.TRANSACTION_DETAIL_TTL);
    }

    return transactions;
  }

  /**
   * Get completed transactions for a user
   */
  async findCompletedByUserId(userId: string): Promise<PaymentTransactionDocument[]> {
    return this.paymentTransactionModel.find({
      userId: new Types.ObjectId(userId),
      paymentStatus: PaymentStatus.completed,
      isDeleted: false,
    }).sort({ createdAt: -1 });
  }

  /**
   * Update payment status
   */
  async updateStatus(
    transactionId: string,
    status: PaymentStatus,
    gatewayResponse?: Record<string, any>,
  ): Promise<PaymentTransactionDocument> {
    this.logger.log(`Updating transaction ${transactionId} status to ${status}`);

    const transaction = await this.paymentTransactionModel.findById(transactionId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.paymentStatus = status;
    if (gatewayResponse) {
      transaction.gatewayResponse = { ...transaction.gatewayResponse, ...gatewayResponse };
    }

    // Set timestamps based on status
    if (status === PaymentStatus.completed && !transaction.completedAt) {
      transaction.completedAt = new Date();
    }

    await transaction.save();

    // Invalidate cache
    await this.invalidateCache(transaction.userId.toString(), transactionId);

    this.logger.log(`Updated transaction ${transactionId} status to ${status}`);
    return transaction;
  }

  /**
   * Get all transactions with pagination and filters
   */
  async getAllWithPagination(
    filters: QueryPaymentTransactionDto,
    options: { page?: number; limit?: number; sortBy?: string },
    populateOptions?: any[],
    select?: string,
  ): Promise<any> {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = options;
    const query: any = { isDeleted: false };

    // Apply filters
    if (filters.status) {
      query.paymentStatus = filters.status;
    }
    if (filters.gateway) {
      query.paymentGateway = filters.gateway;
    }
    if (filters.referenceFor) {
      query.referenceFor = filters.referenceFor;
    }

    // Build query
    let dbQuery = this.paymentTransactionModel.find(query);

    // Apply select
    if (select) {
      dbQuery = dbQuery.select(select);
    }

    // Apply populate
    if (populateOptions && populateOptions.length > 0) {
      populateOptions.forEach(opt => {
        if (typeof opt === 'string') {
          dbQuery = dbQuery.populate(opt);
        } else if (opt.path) {
          dbQuery = dbQuery.populate(opt);
        }
      });
    }

    // Apply sort
    dbQuery = dbQuery.sort(sortBy.replace(/,/g, ' '));

    // Apply pagination
    const skip = (page - 1) * limit;
    dbQuery = dbQuery.skip(skip).limit(limit);

    // Execute query
    const [data, total] = await Promise.all([
      dbQuery.lean(),
      this.paymentTransactionModel.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Get comprehensive earnings overview
   * Aggregates payment data for admin dashboard
   */
  async getEarningsOverview(): Promise<any> {
    const cacheKey = this.getCacheKey('earnings');

    // Try cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug('Returning cached earnings overview');
      return cached;
    }

    this.logger.log('Calculating earnings overview...');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = this.getStartOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastWeekStart = this.getStartOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const lastWeekEnd = new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const quarterStart = new Date(Math.floor(now.getMonth() / 3) * 3, 0, 1);

    const completedStatus = PaymentStatus.completed;
    const baseQuery = { isDeleted: false, paymentStatus: completedStatus };

    // Run aggregations in parallel
    const [
      totalEarnings,
      todayEarnings,
      thisWeekEarnings,
      thisMonthEarnings,
      lastWeekEarnings,
      lastMonthEarnings,
      thisQuarterEarnings,
      thisYearEarnings,
      totalTransactions,
      pendingAmount,
      processingAmount,
    ] = await Promise.all([
      // Total lifetime earnings
      this.modelAggregate(baseQuery),

      // Today's earnings
      this.modelAggregate({ ...baseQuery, createdAt: { $gte: todayStart } }),

      // This week earnings
      this.modelAggregate({ ...baseQuery, createdAt: { $gte: weekStart } }),

      // This month earnings
      this.modelAggregate({ ...baseQuery, createdAt: { $gte: monthStart } }),

      // Last week earnings
      this.modelAggregate({
        ...baseQuery,
        createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd },
      }),

      // Last month earnings
      this.modelAggregate({
        ...baseQuery,
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      }),

      // This quarter earnings
      this.modelAggregate({ ...baseQuery, createdAt: { $gte: quarterStart } }),

      // This year earnings
      this.modelAggregate({ ...baseQuery, createdAt: { $gte: yearStart } }),

      // Total transactions count
      this.paymentTransactionModel.countDocuments(baseQuery),

      // Pending amount
      this.modelAggregate({
        isDeleted: false,
        paymentStatus: PaymentStatus.pending,
      }),

      // Processing amount
      this.modelAggregate({
        isDeleted: false,
        paymentStatus: PaymentStatus.processing,
      }),
    ]);

    // Calculate growth percentages
    const thisWeekTotal = thisWeekEarnings[0]?.total || 0;
    const lastWeekTotal = lastWeekEarnings[0]?.total || 0;
    const weeklyGrowth = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0;

    const thisMonthTotal = thisMonthEarnings[0]?.total || 0;
    const lastMonthTotal = lastMonthEarnings[0]?.total || 0;
    const monthlyGrowth = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

    // Get month names
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const currentMonth = monthNames[now.getMonth()];
    const lastMonth = monthNames[lastMonthStart.getMonth()];

    // Format date
    const formatDate = (date: Date) => {
      return `${date.getDate()} ${monthNames[date.getMonth()].slice(0, 3)}`;
    };

    const result = {
      totalEarnings: totalEarnings[0]?.total || 0,
      todayEarnings: {
        label: 'Today earning',
        amount: todayEarnings[0]?.total || 0,
        count: todayEarnings[0]?.count || 0,
      },
      thisWeekEarnings: {
        amount: thisWeekTotal,
        count: thisWeekEarnings[0]?.count || 0,
        growth: weeklyGrowth.toFixed(2),
        dateRange: `${formatDate(lastWeekStart)} - ${formatDate(lastWeekEnd)}`,
        label: 'This week earning',
      },
      thisMonthEarnings: {
        amount: thisMonthTotal,
        count: thisMonthEarnings[0]?.count || 0,
        growth: monthlyGrowth.toFixed(2),
        month: currentMonth,
        label: 'This month earning',
      },
      lastWeekEarnings: {
        amount: lastWeekTotal,
        count: lastWeekEarnings[0]?.count || 0,
        label: 'Last week earning',
        dateRange: `${formatDate(lastWeekStart)} - ${formatDate(lastWeekEnd)}`,
      },
      lastMonthEarnings: {
        amount: lastMonthTotal,
        count: lastMonthEarnings[0]?.count || 0,
        label: 'Previous month earning',
        month: lastMonth,
      },
      thisQuarterEarnings: {
        amount: thisQuarterEarnings[0]?.total || 0,
        count: thisQuarterEarnings[0]?.count || 0,
        label: 'This quarter earning',
      },
      thisYearEarnings: {
        amount: thisYearEarnings[0]?.total || 0,
        count: thisYearEarnings[0]?.count || 0,
        label: 'This year earning',
      },
      totalTransactions,
      pendingPayments: {
        amount: pendingAmount[0]?.total || 0,
        count: pendingAmount[0]?.count || 0,
        label: 'Pending payments',
      },
      processingPayments: {
        amount: processingAmount[0]?.total || 0,
        count: processingAmount[0]?.count || 0,
        label: 'Processing payments',
      },
    };

    // Cache the result
    await this.setInCache(cacheKey, result, PAYMENT_CACHE_CONFIG.EARNINGS_SUMMARY_TTL);

    return result;
  }

  /**
   * Helper method for aggregation
   */
  private async modelAggregate(matchQuery: any): Promise<any[]> {
    return this.paymentTransactionModel.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
  }

  /**
   * Helper method to get start of week (Sunday)
   */
  private getStartOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  }

  /**
   * Validate SSLCommerz transaction
   */
  async validateSSLTransaction(valId: string): Promise<{ valid: boolean; data?: any }> {
    this.logger.log(`Validating SSLCommerz transaction: ${valId}`);

    try {
      // Note: SSLCommerz validation would be implemented here
      // This requires the sslcommerz-lts package and proper configuration
      // For now, this is a placeholder

      this.logger.warn('SSLCommerz validation not yet implemented');
      return { valid: false };
    } catch (error) {
      this.logger.error(`SSLCommerz validation failed: ${error.message}`, error.stack);
      return { valid: false, data: error.message };
    }
  }

  /**
   * Delete transaction (soft delete)
   */
  async delete(id: string): Promise<PaymentTransactionDocument> {
    this.logger.log(`Soft deleting transaction: ${id}`);

    const transaction = await this.paymentTransactionModel.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.isDeleted = true;
    await transaction.save();

    // Invalidate cache
    await this.invalidateCache(transaction.userId.toString(), id);

    return transaction;
  }
}
