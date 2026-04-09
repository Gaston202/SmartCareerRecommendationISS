import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      const result = (await super.canActivate(context)) as boolean;
      const jwtPayload = (await super.getRequest(context).user) as any;

      if (!result || !jwtPayload) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Fetch fresh user data from Supabase
      const user = await this.authService.validateUserFromSupabase(jwtPayload.access_token || jwtPayload.token);
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
