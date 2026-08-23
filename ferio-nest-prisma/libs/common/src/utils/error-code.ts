export type ApplicationErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'AUTHENTICATION_REQUIRED'
  | 'ACCESS_FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT';

const STATUS_ERROR_CODES: Record<number, ApplicationErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'ACCESS_FORBIDDEN',
  404: 'RESOURCE_NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE',
  504: 'UPSTREAM_TIMEOUT',
};

const VALID_EXPLICIT_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;

export function resolveErrorCode(
  status: number,
  explicitCode?: unknown,
  validationFailure = false,
): string {
  if (
    typeof explicitCode === 'string' &&
    VALID_EXPLICIT_CODE.test(explicitCode)
  ) {
    return explicitCode;
  }
  if (status === 400 && validationFailure) return 'VALIDATION_ERROR';
  return STATUS_ERROR_CODES[status] ?? 'INTERNAL_ERROR';
}
