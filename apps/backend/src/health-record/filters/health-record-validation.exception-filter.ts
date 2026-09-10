import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

const KNOWN_FIELDS = [
  'kind',
  'name',
  'administeredAt',
  'dueAt',
  'doseAmount',
  'doseUnit',
  'vaccineBatch',
  'note',
  'reminderEnabled',
] as const;

/**
 * Reshapes the app-global `ValidationPipe`'s default 400 body (a flat
 * `message: string[]`, see `main.ts`) into the machine-readable
 * `{ code: 'VALIDATION_ERROR', fields }` shape the frontend's
 * `mapHealthRecordError` reads — without touching the global pipe, which would
 * change every other controller's 400 shape too. Same design and same
 * reasoning as `MilestoneValidationExceptionFilter`.
 *
 * A body that already carries a `code` (thrown directly by
 * `HealthRecordService`'s cross-column checks, or already reshaped) is passed
 * through unchanged.
 */
@Catch(BadRequestException)
export class HealthRecordValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = exception.getResponse();

    if (typeof body !== 'object' || body === null || 'code' in body) {
      response.status(exception.getStatus()).json(body);
      return;
    }

    const messages = (body as { message?: unknown }).message;
    if (!Array.isArray(messages)) {
      response.status(exception.getStatus()).json(body);
      return;
    }

    response.status(400).json({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: this.bucketByField(messages as string[]),
    });
  }

  private bucketByField(messages: string[]): Record<string, string[]> {
    const fields: Record<string, string[]> = {};
    for (const message of messages) {
      const field = KNOWN_FIELDS.find((name) => message.startsWith(name)) ?? '_other';
      (fields[field] ??= []).push(message);
    }
    return fields;
  }
}
