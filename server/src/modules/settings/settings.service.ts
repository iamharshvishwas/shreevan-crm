import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  channels() {
    return this.prisma.channelConnection.findMany({ orderBy: { channel: 'asc' } });
  }

  slaPolicies() {
    return this.prisma.slaPolicy.findMany({ orderBy: { firstResponseMins: 'asc' } });
  }

  routingRules() {
    return this.prisma.routingRule.findMany({ orderBy: { priorityOrder: 'asc' } });
  }
}
