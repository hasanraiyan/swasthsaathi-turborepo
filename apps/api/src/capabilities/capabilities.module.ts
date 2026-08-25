import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CapabilitiesController } from './capabilities.controller';
import { CapabilityRegistry } from './capability-registry.service';

/**
 * Global so any module -- and later the agent module -- can inject the
 * registry without importing this one. `DiscoveryModule` is what lets the
 * registry find capability providers without each feature module registering
 * itself by hand.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [CapabilitiesController],
  providers: [CapabilityRegistry],
  exports: [CapabilityRegistry],
})
export class CapabilitiesModule {}
