import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Maps Multer-level upload errors (oversized file, wrong field name, etc.)
 * to a clean `400`, matching the shape Nest's `ValidationPipe`/
 * `ParseFilePipeBuilder` already use for other validation failures. Applied
 * per-route (create/update) via `@UseFilters(...)`, not globally — see
 * ADR-0003.
 *
 * Catches two exception shapes for the same underlying condition:
 * - `MulterError` directly — the raw error Multer throws, kept for
 *   defense-in-depth/testability.
 * - `PayloadTooLargeException` — what `@nestjs/platform-express`'s
 *   `FileInterceptor` actually throws in practice: it already translates a
 *   `LIMIT_FILE_SIZE` `MulterError` into this *before* it reaches any
 *   `@Catch(MulterError)` filter (see its `transformException()` helper),
 *   which would otherwise surface as an unwanted `413` instead of this
 *   app's uniform `400` for all upload validation failures.
 */
@Catch(MulterError, PayloadTooLargeException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const message =
      exception instanceof MulterError
        ? this.messageFor(exception)
        : 'Uploaded file exceeds the maximum allowed size';
    const badRequest = new BadRequestException(message);
    response.status(badRequest.getStatus()).json(badRequest.getResponse());
  }

  private messageFor(exception: MulterError): string {
    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        return 'Uploaded file exceeds the maximum allowed size';
      case 'LIMIT_UNEXPECTED_FILE':
        return `Unexpected file field "${exception.field}"`;
      default:
        return exception.message;
    }
  }
}
