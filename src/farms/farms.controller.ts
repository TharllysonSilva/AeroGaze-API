import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsIn, IsObject, IsString, MinLength } from 'class-validator';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { FarmScopeService } from './farm-scope.service';

class CreatePlotDto {
  @IsString() @MinLength(2) name: string;
  @IsIn(['talhao', 'piquete']) kind: 'talhao' | 'piquete';
  /** GeoJSON Polygon em WGS84: { "type": "Polygon", "coordinates": [[[lon,lat], ...]] } */
  @IsObject() boundary: Record<string, unknown>;
}

@Controller('v1/farms')
export class FarmsController {
  constructor(private readonly db: DatabaseService, private readonly scope: FarmScopeService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const { rows } = await this.db.query(
      `SELECT id, name FROM farms
        WHERE organization_id = $1 AND ($2::uuid IS NULL OR id = $2)
        ORDER BY name`,
      [user.organizationId, user.farmId],
    );
    return rows;
  }

  @Get(':farmId/plots')
  async plots(@CurrentUser() user: AuthUser, @Param('farmId', ParseUUIDPipe) farmId: string) {
    await this.scope.assertFarm(user, farmId);
    const { rows } = await this.db.query(
      `SELECT id, name, kind, ST_AsGeoJSON(boundary)::json AS boundary
         FROM plots WHERE farm_id = $1 ORDER BY name`,
      [farmId],
    );
    return rows;
  }

  @Post(':farmId/plots')
  @Roles('gerente', 'administrador')
  async createPlot(
    @CurrentUser() user: AuthUser,
    @Param('farmId', ParseUUIDPipe) farmId: string,
    @Body() dto: CreatePlotDto,
  ) {
    await this.scope.assertFarm(user, farmId);
    let row;
    try {
      const res = await this.db.query(
        `INSERT INTO plots (farm_id, name, kind, boundary)
         VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
         RETURNING id, name, kind`,
        [farmId, dto.name, dto.kind, JSON.stringify(dto.boundary)],
      );
      row = res.rows[0];
    } catch {
      throw new BadRequestException('boundary inválido: envie um GeoJSON Polygon em WGS84');
    }
    await this.db.query(
      `INSERT INTO audit_log (organization_id, user_id, action, entity, entity_id) VALUES ($1,$2,'plot.create','plot',$3)`,
      [user.organizationId, user.id, row.id],
    );
    return row;
  }
}
