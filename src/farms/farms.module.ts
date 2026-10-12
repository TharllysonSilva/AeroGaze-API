import { Global, Module } from '@nestjs/common';
import { FarmScopeService } from './farm-scope.service';
import { FarmsController } from './farms.controller';

@Global()
@Module({
  controllers: [FarmsController],
  providers: [FarmScopeService],
  exports: [FarmScopeService],
})
export class FarmsModule {}
