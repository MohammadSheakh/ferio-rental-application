import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Database Exception Filter
 * Prisma-only build: keep the filter behavior generic and avoid Mongoose types.
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Features:
 * ✅ User-friendly error messages
 * ✅ Proper HTTP status codes
 * ✅ Detailed logging
 * ✅ Development stack traces
 */
@Catch()
export class MongooseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MongooseExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error occurred';
    let error = 'Database Error';

    const errorObject = exception as any;

    // Prisma databases often surface structured errors with a code field.
    if (errorObject?.code === 'P2002' || errorObject?.code === 11000) {
      status = HttpStatus.CONFLICT;
      const field = Object.keys(errorObject?.meta?.target || errorObject?.keyValue || {})[0];
      message = field ? `${field} already exists` : 'Record already exists';
      error = 'Duplicate Key Error';
    }

    if (errorObject?.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Record not found';
      error = 'Not Found';
    }

    if (errorObject?.name === 'PrismaClientKnownRequestError') {
      status = HttpStatus.BAD_REQUEST;
      message = errorObject?.message || message;
      error = 'Database Error';
    }

    if (exception instanceof Error && message === 'Database error occurred') {
      message = exception.message;
      error = exception.name || error;
    }

    if (errorObject?.name === 'MongoServerError') {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database service unavailable';
      error = 'Database Unavailable';
    }

    if (errorObject?.name === 'MongoNetworkError') {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Cannot connect to database';
      error = 'Network Error';
    }

    if (errorObject?.name === 'MongoTimeoutError') {
      status = HttpStatus.GATEWAY_TIMEOUT;
      message = 'Database operation timed out';
      error = 'Timeout Error';
    }

    // Get user ID if authenticated
    const user = request as any;
    const userId = user.user?.userId || 'anonymous';

    // Log error with context
    this.logger.error(
      `${request.method} ${request.url} ${status} - ${message} - User: ${userId}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Build response body
    const responseBody: any = {
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Include stack trace in development mode
    if (process.env.NODE_ENV === 'development') {
      responseBody.stack = exception instanceof Error ? exception.stack : undefined;
    }

    response.status(status).json(responseBody);
  }
}
