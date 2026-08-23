import { Injectable, Inject, Logger } from '@nestjs/common';
import { IFileUploadStrategy } from './file-upload.strategy.interface';
import { CloudinaryStrategy } from './cloudinary.strategy';
import { S3Strategy } from './s3.strategy';

/**
 * File Upload Strategy Factory
 * 
 * 📚 STRATEGY PATTERN IMPLEMENTATION
 * 
 * Creates and provides the appropriate file upload strategy
 * based on configuration
 * 
 * Usage:
 * const strategy = FileUploadStrategyFactory.getStrategy('cloudinary');
 * const result = await strategy.uploadFile(file, 'folder');
 */
@Injectable()
export class FileUploadStrategyFactory {
  private static strategies: Map<string, IFileUploadStrategy> = new Map();
  private static defaultStrategy: string = 'cloudinary';
  private readonly logger = new Logger(FileUploadStrategyFactory.name);

  constructor(
    @Inject('CLOUDINARY_STRATEGY') private cloudinaryStrategy: CloudinaryStrategy,
    @Inject('S3_STRATEGY') private s3Strategy: S3Strategy,
  ) {
    // Register strategies
    FileUploadStrategyFactory.strategies.set('cloudinary', cloudinaryStrategy);
    FileUploadStrategyFactory.strategies.set('s3', s3Strategy);
    FileUploadStrategyFactory.strategies.set('digitalocean', s3Strategy); // DigitalOcean uses S3 strategy

    // Set default strategy from environment
    FileUploadStrategyFactory.defaultStrategy =
      process.env.FILE_UPLOAD_STRATEGY || 'cloudinary';
  }

  /**
   * Get file upload strategy
   * 
   * @param strategyName - Strategy name (cloudinary, s3, digitalocean)
   * @returns File upload strategy instance
   */
  getStrategy(strategyName?: string): IFileUploadStrategy {
    const name = strategyName || FileUploadStrategyFactory.defaultStrategy;
    const strategy = FileUploadStrategyFactory.strategies.get(name);

    if (!strategy) {
      const available = Array.from(FileUploadStrategyFactory.strategies.keys()).join(', ');
      throw new Error(
        `Unknown file upload strategy: ${name}. Available strategies: ${available}`,
      );
    }

    this.logger.log(`Using file upload strategy: ${name}`);
    return strategy;
  }

  /**
   * Get default strategy
   */
  getDefaultStrategy(): IFileUploadStrategy {
    return this.getStrategy();
  }

  /**
   * Set default strategy
   * 
   * @param strategyName - Strategy name
   */
  static setDefaultStrategy(strategyName: string): void {
    FileUploadStrategyFactory.defaultStrategy = strategyName;
  }

  /**
   * Get available strategies
   */
  static getAvailableStrategies(): string[] {
    return Array.from(FileUploadStrategyFactory.strategies.keys());
  }
}
