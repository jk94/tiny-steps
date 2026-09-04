import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

/**
 * Holds `RealtimeService` alone, separate from `RealtimeModule`.
 *
 * `RealtimeModule` imports `HouseholdModule` (the gateway needs
 * `HouseholdAccessService` for its join-time membership check), so having
 * `HouseholdModule` import `RealtimeModule` back — which it must, to evict a
 * removed member from the household's Socket.IO room — would be a module
 * cycle needing `forwardRef()` on both sides.
 *
 * `RealtimeService` itself has no constructor dependencies, so splitting it
 * out breaks the cycle without a `forwardRef`: this module imports nothing,
 * and both `RealtimeModule` and `HouseholdModule` import it to share the one
 * singleton instance that `RealtimeGateway.afterInit()` hands the Socket.IO
 * server to. Providing `RealtimeService` in both modules instead would create
 * two instances, only one of which would ever have a server.
 */
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeCoreModule {}
