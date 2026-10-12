import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { DatabaseService } from '../database/database.service';

@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  /** Usado pelo health check da plataforma de hospedagem. */
  @Public()
  @Get('health')
  async health() {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ok', db: 'ok', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', db: 'down' });
    }
  }
}
