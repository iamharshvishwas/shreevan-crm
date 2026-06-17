import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  /** Flush pending writes and close the pool on shutdown. */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
