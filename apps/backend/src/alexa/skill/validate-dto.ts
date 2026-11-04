import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

/**
 * Runs a request DTO's own class-validator rules on a payload the skill built
 * itself, before handing it to the domain service. The services trust their
 * DTOs (the HTTP `ValidationPipe` normally guarantees them), so voice input
 * must clear exactly the same bar — e.g. the 1–2000 ml bottle range or "no
 * timestamps in the future". The handlers check the user-facing limits first
 * to give a helpful answer; this is the backstop that keeps both paths equal.
 */
export function toValidatedDto<T extends object>(cls: ClassConstructor<T>, plain: object): T {
  const instance = plainToInstance(cls, plain);
  const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) {
    throw new Error(
      `Alexa payload failed ${cls.name} validation: ${errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }
  return instance;
}
