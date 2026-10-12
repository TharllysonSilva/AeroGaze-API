import { Global, Module } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { RulesService } from './rules.service';

@Global()
@Module({
  providers: [GeofenceService, RulesService],
  exports: [GeofenceService, RulesService],
})
export class RulesModule {}
