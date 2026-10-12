import { Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { SolanaService } from './solana.service';
@Controller('v1/solana')
class SolanaController{
  constructor(private readonly solana:SolanaService,private readonly db:DatabaseService){}
  @Post('receipts/:eventId') @Roles('operador','veterinario','gerente','administrador')
  async receipt(@CurrentUser() user:AuthUser,@Param('eventId',ParseUUIDPipe) eventId:string){
    const {rows}=await this.db.query('SELECT * FROM sync_events WHERE id=$1 AND organization_id=$2 AND ($3::uuid IS NULL OR farm_id=$3)',[eventId,user.organizationId,user.farmId]);
    if(!rows[0])throw new NotFoundException('Evento não encontrado');
    await this.solana.enqueue(rows[0]);void this.solana.tick();
    return this.solana.verify(eventId);
  }
  @Public() @Get('verify/:eventId')
  verify(@Param('eventId',ParseUUIDPipe) eventId:string){return this.solana.verify(eventId);}
}
@Module({controllers:[SolanaController],providers:[SolanaService],exports:[SolanaService]})
export class SolanaModule{}
