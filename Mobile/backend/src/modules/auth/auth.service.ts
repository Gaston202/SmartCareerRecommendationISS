import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../core/database/database.service';
import type { User } from '@supabase/supabase-js';

interface SupabaseUser {
  id: string;
  email: string;
  aud: string;
  role: string;
  email_confirmed_at?: string;
  created_at: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private db: DatabaseService,
  ) {}

  async validateUserFromSupabase(token: string): Promise<SupabaseUser> {
    try {
      this.logger.debug(`Validating token with Supabase (token length: ${token.length})`);
      const { data: { user }, error } = await this.db.supabaseAnon.auth.getUser(token);

      if (error) {
        this.logger.warn('Supabase token validation error:', {
          message: error.message,
          status: error.status,
          code: error.code,
        });
        throw new UnauthorizedException('Invalid or expired token');
      }

      if (!user) {
        this.logger.warn('No user returned from Supabase for token');
        throw new UnauthorizedException('Invalid or expired token');
      }

      this.logger.debug(`Token valid for user: ${user.id}, email: ${user.email}`);
      return {
        id: user.id,
        email: user.email!,
        aud: user.aud,
        role: user.role,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
      } as SupabaseUser;
    } catch (error: any) {
      this.logger.warn('Token validation failed', {
        error: error.message,
        stack: error.stack,
      });
      throw new UnauthorizedException('Token validation failed');
    }
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const { data, error } = await this.db.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to fetch user profile', error);
      return null;
    }
  }

  async createOrUpdateUserProfile(userId: string, profileData: any): Promise<any> {
    try {
      const { data, error } = await this.db.supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      this.logger.error('Failed to upsert user profile', error);
      throw error;
    }
  }
}
