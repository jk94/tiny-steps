import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Request body for the Feeding/Sleep `POST .../:eventId/stop` routes. The single
 * optional `clientTimestamp` carries the wall-clock instant the stop was
 * submitted client-side; when present it activates Last-Write-Wins in the
 * service (a stop older than the server's `updatedAt` is rejected as a
 * conflict). Absent for a normal online stop, which keeps today's unconditional
 * behavior — see ADR-0011.
 */
export class StopEventDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  clientTimestamp?: string;
}
