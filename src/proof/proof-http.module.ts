import { Module } from '@nestjs/common';
import { ProofController } from './proof.controller';

/** Endpoints de verificação e de prova de inclusão (somente na API). */
@Module({ controllers: [ProofController] })
export class ProofHttpModule {}
