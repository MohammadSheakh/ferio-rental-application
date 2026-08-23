import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sanitizeLogText, sanitizeUrlForLogs } from '../utils/log-sanitizer';
import { getCorrelationId } from '../utils/request-context';
import { resolveErrorCode } from '../utils/error-code';
import { StructuredLogger } from '../utils/structured-logger';

/**
 * HTTP Exception Filter
 *
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 *
 * Catches all HTTP exceptions and returns standardized error response:
 * {
 *   success: false,
 *   statusCode: 400,
 *   message: 'Error message',
 *   error: 'Bad Request',
 *   timestamp: '2026-03-17T10:00:00.000Z',
 *   path: '/api/v1/users'
 * }
 *
 * Features:
 * ✅ Consistent error response format
 * ✅ Detailed logging
 * ✅ Stack trace in development
 * ✅ User context logging
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    // Extract error message
    let message: string;
    let error: string;
    let explicitCode: unknown;
    let validationFailure = false;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      error = HttpStatus[status];
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as any;
      message = responseObj.message || responseObj.error || 'An error occurred';
      error = responseObj.error || HttpStatus[status];
      explicitCode = responseObj.code;

      if (Array.isArray(message)) {
        validationFailure = true;
        message = message.join(', ');
      }
    } else {
      message = 'An unexpected error occurred';
      error = HttpStatus[status];
    }

    message = sanitizeLogText(message);
    error = sanitizeLogText(error);
    const safePath = sanitizeUrlForLogs(request.url);
    const correlationId = getCorrelationId();
    const code = resolveErrorCode(status, explicitCode, validationFailure);

    // Get user ID if authenticated
    const user = request as any;
    const userId = user.user?.userId || 'anonymous';

    // Log error with context
    this.logger.error('http_request_failed', exception, {
      method: request.method,
      path: safePath,
      statusCode: status,
      errorCode: code,
      message,
      userId,
    });

    // Build response body
    const responseBody: any = {
      success: false,
      statusCode: status,
      message,
      error,
      code,
      timestamp: new Date().toISOString(),
      path: safePath,
      correlationId,
    };

    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      responseBody.stack = sanitizeLogText(exception.stack);
    }

    response.status(status).json(responseBody);
  }
}
