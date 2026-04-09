import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly supabase: SupabaseClient;
  readonly supabaseAnon: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!url || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    this.supabase = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.supabaseAnon = createClient(url, anonKey || serviceKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  onModuleInit() {
    console.log('Database service initialized');
  }

  onModuleDestroy() {
    // Supabase client doesn't need explicit cleanup
  }
}
