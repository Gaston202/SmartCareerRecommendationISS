import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import type { RefreshProviderDto } from './roadmap-rag.types';

@Injectable()
export class RoadmapRefreshService {
  private readonly logger = new Logger(RoadmapRefreshService.name);

  constructor(private readonly db: DatabaseService) {}

  async requestProviderRefresh(userId: string, dto: RefreshProviderDto): Promise<any> {
    const mode = dto.mode || 'on_demand_refresh';

    const { data, error } = await this.db.supabase
      .from('ingestion_jobs')
      .insert([
        {
          provider: dto.provider,
          job_type: mode,
          status: 'pending',
          requested_by: userId,
          trigger_reason: dto.reason || 'manual refresh request',
          filters: dto.filters || {},
        },
      ])
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to create ingestion refresh job', error);
      throw error;
    }

    return {
      id: data.id,
      provider: data.provider,
      status: data.status,
      job_type: data.job_type,
      created_at: data.created_at,
      message: 'Refresh request accepted. Python ingestion worker should pick this job.',
    };
  }
}
