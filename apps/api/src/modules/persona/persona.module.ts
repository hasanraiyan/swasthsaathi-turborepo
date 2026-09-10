import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PersonaModule } from '@personaai/adapters/nestjs';
import { verifyToken } from '@clerk/backend';

interface AuthenticatedRequest {
  auth?: { userId?: string };
  user?: { id?: string };
  headers?: Record<string, string | string[] | undefined>;
}

@Module({
  imports: [
    PersonaModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const baseUrl =
          config.get<string>('PERSONA_BASE_URL') ||
          process.env.PERSONA_BASE_URL ||
          'https://api.persona.hasanraiyan.me';
        const credential =
          config.get<string>('PERSONA_CREDENTIAL') ||
          process.env.PERSONA_CREDENTIAL ||
          '';
        const secretKey =
          config.get<string>('CLERK_SECRET_KEY') ||
          process.env.CLERK_SECRET_KEY;

        return {
          baseUrl,
          credential,
          routePrefix: 'persona',
          mountPath: '/api/persona',
          resolveUserFrom: async (rawReq: unknown): Promise<string | null> => {
            const req = rawReq as AuthenticatedRequest;
            if (typeof req.auth?.userId === 'string') {
              return req.auth.userId;
            }
            if (typeof req.user?.id === 'string') {
              return req.user.id;
            }
            const authHeader = req.headers?.authorization;
            const headerStr =
              typeof authHeader === 'string' ? authHeader : undefined;
            if (headerStr?.startsWith('Bearer ') && secretKey) {
              try {
                const payload = await verifyToken(headerStr.slice(7), {
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
