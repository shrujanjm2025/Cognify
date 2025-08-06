export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly field?: string;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    field?: string,
    isOperational = true,
    stack = ''
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.field = field;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string, code?: string, field?: string): ApiError {
    return new ApiError(400, message, code, field);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string): ApiError {
    return new ApiError(401, message, code);
  }

  static forbidden(message: string = 'Forbidden', code?: string): ApiError {
    return new ApiError(403, message, code);
  }

  static notFound(message: string = 'Resource not found', code?: string): ApiError {
    return new ApiError(404, message, code);
  }

  static conflict(message: string, code?: string, field?: string): ApiError {
    return new ApiError(409, message, code, field);
  }

  static unprocessableEntity(message: string, code?: string, field?: string): ApiError {
    return new ApiError(422, message, code, field);
  }

  static tooManyRequests(message: string = 'Too many requests', code?: string): ApiError {
    return new ApiError(429, message, code);
  }

  static internal(message: string = 'Internal server error', code?: string): ApiError {
    return new ApiError(500, message, code, undefined, false);
  }

  static serviceUnavailable(message: string = 'Service unavailable', code?: string): ApiError {
    return new ApiError(503, message, code, undefined, false);
  }
}