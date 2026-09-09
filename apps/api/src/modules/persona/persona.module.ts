import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PersonaModule } from '@personaai/adapters/nestjs';
import { verifyToken } from '@clerk/backend';

@Module({
  imports: [
    PersonaModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const baseUrl =
          config.get<string>('PERSONA_BASE_URL') ||
          process.env.PERSONA_BASE_URL ||
          'https://persona.hasanraiyan.me';
        const credential =
          config.get<string>('PERSONA_CREDENTIAL') ||
          process.env.PERSONA_CREDENTIAL ||
          '';
        const secretKey =
          config.get<string>('CLERK_SECRET_KEY') || process.env.CLERK_SECRET_KEY;

        return {
          baseUrl,
          credential,
          routePrefix: '/api/persona',
          resolveUserFrom: async (req: any) => {
            if (req.auth?.userId) {
              return req.auth.userId;
            }
            if (req.user?.id) {
              return req.user.id;
            }
            const authHeader = req.headers?.authorization;
            if (authHeader?.startsWith('Bearer ') && secretKey) {
              try {
                const payload = await verifyToken(authHeader.slice(7), {
                  secretKey,
                });
                return payload.sub;
              } catch {
                return null;
              }
            }
            return null;
          },
        };
      },
    }),
  ],
  exports: [PersonaModule],
})
export class PersonaIntegrationModule {}
