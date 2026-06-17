import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../common/auth/decorators';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  async ready(): Promise<{ status: string; postgres: 'up' | 'down' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', postgres: 'up' };
    } catch {
      return { status: 'degraded', postgres: 'down' };
    }
  }
}
