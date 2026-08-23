import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Transform Response Interceptor
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Standardizes all API responses to a consistent format:
 * {
 *   success: true,
 *   data: { ... },
 *   message: 'Operation successful'
 * }
 * 
 * Features:
 * ✅ Consistent response structure
 * ✅ Automatic success flag
 * ✅ Optional message
 * ✅ Error handling passthrough
 * 
 * Usage:
 * @UseInterceptors(TransformResponseInterceptor)
 * async getData() {
 *   return { id: 1, name: 'Test' };
 *   // Transforms to: { success: true, data: { id: 1, name: 'Test' } }
 * }
 */
export interface Response<T> {
  data: T;
  message?: string;
  success?: boolean;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is already in response format, return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // If data already has a message field, preserve it
        if (data && typeof data === 'object' && 'message' in data) {
          return {
            success: true,
            ...data,
          };
        }

        // Wrap data in standard response format
        return {
          success: true,
          data,
          message: this.getMessageFromContext(context),
        };
      }),
    );
  }

  /**
   * Get message based on HTTP method and context
   */
  private getMessageFromContext(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    const messages: Record<string, string> = {
      GET: 'Data retrieved successfully',
      POST: 'Resource created successfully',
      PUT: 'Resource updated successfully',
      PATCH: 'Resource partially updated successfully',
      DELETE: 'Resource deleted successfully',
    };

    return messages[method] || 'Operation successful';
  }
}
