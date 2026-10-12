import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { loadEnv } from '../config/env';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return { secret: env.jwtSecret, signOptions: { expiresIn: env.jwtExpiresIn as any } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Ordem importa: primeiro autentica, depois confere o papel.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
