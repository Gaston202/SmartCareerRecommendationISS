import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface QueueJobData {
  userId: string;
  [key: string]: any;
}

export const CV_ANALYSIS_QUEUE = 'cv-analysis';
export const AI_PROCESSING_QUEUE = 'ai-processing';
export const ROADMAP_GENERATION_QUEUE = 'roadmap-generation';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly redis: Redis;
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Worker[] = [];

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL is required for queue system');
    }

    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.initializeQueues();
  }

  private initializeQueues() {
    const queues = [
      CV_ANALYSIS_QUEUE,
      AI_PROCESSING_QUEUE,
      ROADMAP_GENERATION_QUEUE,
    ];

    queues.forEach((queueName) => {
      const queue = new Queue(queueName, {
        connection: this.redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 100,
            age: 24 * 60 * 60 * 1000, // 24 hours
          },
          removeOnFail: {
            count: 100,
            age: 24 * 60 * 60 * 1000,
          },
        },
      });

      this.queues.set(queueName, queue);
      this.logger.log(`Queue initialized: ${queueName}`);
    });
  }

  getQueue(name: string): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue not found: ${name}`);
    }
    return queue;
  }

  async addJob(queueName: string, name: string, data: QueueJobData, opts?: any): Promise<Job> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(name, data, opts);
    this.logger.debug(`Job added to ${queueName}: ${job.id} (${name})`);
    return job;
  }

  async getJobStatus(jobId: string): Promise<any> {
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        const progress = job.progress;
        return {
          id: job.id,
          name: job.name,
          data: job.data,
          state,
          progress,
          failedReason: job.failedReason,
          finishedOn: job.finishedOn,
          processedOn: job.processedOn,
        };
      }
    }
    return null;
  }

  onModuleDestroy() {
    this.logger.log('Shutting down queue service...');
    this.workers.forEach((worker) => worker.close());
    this.queues.forEach((queue) => queue.close());
    this.redis.quit();
  }
}
