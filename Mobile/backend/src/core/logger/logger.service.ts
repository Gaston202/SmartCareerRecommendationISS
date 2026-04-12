import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pino from 'pino';

@Injectable()
export class LoggerService implements OnModuleDestroy {
  private readonly logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
      serializers: {
        req: (req: any) => ({
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
        }),
        res: (res: any) => ({
          statusCode: res.statusCode,
        }),
        err: pino.stdSerializers.err,
      },
    });
  }

  log(message: string, ...args: any[]) {
    this.logger.info(message, ...args);
  }

  error(message: string, traceOrError?: any, ...args: any[]) {
    if (traceOrError instanceof Error) {
      this.logger.error(message, { stack: traceOrError.stack, ...args });
    } else {
      this.logger.error(message, traceOrError, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    this.logger.warn(message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.logger.debug(message, ...args);
  }

  verbose(message: string, ...args: any[]) {
    this.logger.debug(message, ...args);
  }

  onModuleDestroy() {
    this.logger.flush();
  }
}
