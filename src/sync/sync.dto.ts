import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class SyncEventDto {
  /** UUID v4 gerado NO APARELHO: é a chave de idempotência. */
  @IsUUID() id: string;

  /** ex.: inspection.recorded, position.reported, task.completed */
  @IsString() @Matches(/^[a-z]+(\.[a-z_]+)+$/) type: string;

  @IsInt() @Min(1) schemaVersion: number;

  /** Momento em que aconteceu no campo (relógio do aparelho), ISO 8601. */
  @IsISO8601() occurredAt: string;

  /**
   * Convenções:
   *  - posição:  payload.location = { lat, lon, accuracyM }
   *  - IA:       payload.ai       = { label, confidence, modelVersion }
   *  - ativo:    payload.assetId  = "BR-042" (animal, máquina, drone)
   */
  @IsObject() payload: Record<string, any>;
}

export class SyncRequestDto {
  @IsUUID() farmId: string;
  @IsString() @Length(3, 64) deviceId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  events: SyncEventDto[];
}

export type AckStatus = 'accepted' | 'duplicate' | 'rejected';

export interface EventAck {
  id: string;
  status: AckStatus;
  /** Só em rejected: motivo legível para o app mostrar em "Rejeitado". */
  reason?: string;
}
