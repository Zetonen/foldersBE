import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof QueryFailedError) {
      return this.fromDatabaseError(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private fromHttpException(exception: HttpException): ErrorBody {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode, message: payload, error: this.reasonFor(statusCode) };
    }

    const { message, error } = payload as { message?: string | string[]; error?: string };

    return {
      statusCode,
      message: message ?? exception.message,
      error: error ?? this.reasonFor(statusCode),
    };
  }

  private fromDatabaseError(exception: QueryFailedError): ErrorBody {
    const code = (exception as { code?: string }).code;

    if (code === UNIQUE_VIOLATION) {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        error: 'Conflict',
      };
    }

    if (code === FOREIGN_KEY_VIOLATION || code === CHECK_VIOLATION) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Request violates a data constraint',
        error: 'Bad Request',
      };
    }

    this.logger.error(`Unhandled database error ${code}: ${exception.message}`);

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private reasonFor(statusCode: number): string {
    return (
      Object.entries(HttpStatus).find(([, value]) => value === statusCode)?.[0] ?? 'Error'
    )
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
