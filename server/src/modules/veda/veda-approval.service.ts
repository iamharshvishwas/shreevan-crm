import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { VedaApproval } from '@prisma/client';

export interface CreateApprovalData {
  type: string;
  entityType: string;
  entityId: string;
  draftText: string;
  payload: object;
  context?: object;
  expiresInHours?: number;
}

@Injectable()
export class VedaApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateApprovalData): Promise<VedaApproval> {
    const expiresAt = data.expiresInHours
      ? new Date(Date.now() + data.expiresInHours * 3_600_000)
      : undefined;
    return this.prisma.vedaApproval.create({
      data: {
        type:       data.type,
        entityType: data.entityType,
        entityId:   data.entityId,
        draftText:  data.draftText,
        payload:    data.payload,
        context:    data.context,
        expiresAt,
      },
    });
  }

  async list(opts: { status?: string; limit?: number; offset?: number }) {
    const where = opts.status ? { status: opts.status as VedaApproval['status'] } : {};
    const [items, total] = await Promise.all([
      this.prisma.vedaApproval.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:  opts.limit  ?? 50,
        skip:  opts.offset ?? 0,
        include: { logs: { select: { id: true, status: true, createdAt: true } } },
      }),
      this.prisma.vedaApproval.count({ where }),
    ]);
    return { items, total };
  }

  async approve(id: string, reviewedBy: string, note?: string): Promise<VedaApproval> {
    const row = await this.prisma.vedaApproval.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Approval not found');
    return this.prisma.vedaApproval.update({
      where: { id },
      data:  { status: 'APPROVED', reviewedBy, reviewedAt: new Date(), reviewNote: note },
    });
  }

  async reject(id: string, reviewedBy: string, note?: string): Promise<VedaApproval> {
    const row = await this.prisma.vedaApproval.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Approval not found');
    return this.prisma.vedaApproval.update({
      where: { id },
      data:  { status: 'REJECTED', reviewedBy, reviewedAt: new Date(), reviewNote: note },
    });
  }

  async expireStale(): Promise<number> {
    const result = await this.prisma.vedaApproval.updateMany({
      where: { status: 'PENDING', expiresAt: { lte: new Date() } },
      data:  { status: 'EXPIRED' },
    });
    return result.count;
  }

  async pendingCount(): Promise<number> {
    return this.prisma.vedaApproval.count({ where: { status: 'PENDING' } });
  }
}
