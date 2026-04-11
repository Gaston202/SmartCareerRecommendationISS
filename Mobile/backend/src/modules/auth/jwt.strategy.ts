import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Logger } from '@nestjs/common/services/logger.service';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET') || 'supabase-jwt-validation-only';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true, // Get request to extract raw token
    });
  }

  async validate(req: any, payload: any, done: (err: any, user?: any) => void) {
    try {
      // Extract raw token from Authorization header
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      this.logger.debug(`JWT validation attempt. Header present: ${!!authHeader}, Token length: ${token?.length || 0}`);

      if (!token) {
        this.logger.warn('No token provided in Authorization header');
        throw new UnauthorizedException('No token provided');
      }

      // Validate token with Supabase using the raw token
      const user = await this.authService.validateUserFromSupabase(token);
      this.logger.debug(`JWT validation successful for user: ${user?.id}`);
      done(null, user);
    } catch (err: any) {
      this.logger.error(`JWT validation failed: ${err.message}`, err.stack || '');
      done(new UnauthorizedException('Invalid token'), false);
    }
  }
}
