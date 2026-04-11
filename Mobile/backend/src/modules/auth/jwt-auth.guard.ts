import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

@Injectable()
export class JwtAuthGuard {
  constructor(private db: DatabaseService) {
    // No-op
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    try {
      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      const {
        data: { user },
        error,
      } = await this.db.supabaseAnon.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
