import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { SyncRequestDto } from './sync.dto';
import { SyncService } from './sync.service';

@Controller('v1/sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /**
   * Endpoint que o outbox do Flutter (Drift) chama quando a rede volta.
   * Sempre 200 com um recibo POR EVENTO; o status HTTP não diz nada sobre cada evento.
   */
  @Post('events')
  @HttpCode(200)
  @Roles('operador', 'veterinario', 'gerente', 'administrador')
  events(@CurrentUser() user: AuthUser, @Body() body: SyncRequestDto) {
    return this.sync.ingest(user, body);
  }
}
