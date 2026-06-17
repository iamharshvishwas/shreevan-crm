import { Injectable } from '@nestjs/common';
import { Currency, EnquiryStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { computeSla } from '../enquiries/sla.util';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Server-side dashboard aggregates. Money is kept per-currency. */
  async overview() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      newEnquiries,
      needsReply,
      unassigned,
      callsScheduled,
      qualifiedOpportunities,
      confirmedBookings,
      revenueByCurrency,
      breachCandidates,
      recentActivity,
    ] = await Promise.all([
      this.prisma.enquiry.count({ where: { createdAt: { gte: since }, status: { not: EnquiryStatus.SPAM } } }),
      this.prisma.enquiry.count({ where: { status: EnquiryStatus.NEEDS_REPLY } }),
      this.prisma.enquiry.count({ where: { ownerId: null, status: { in: [EnquiryStatus.NEEDS_REPLY, EnquiryStatus.WAITING_FOR_CUSTOMER] } } }),
      this.prisma.discoveryCall.count({ where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() } } }),
      this.prisma.lead.count({ where: { confirmedAt: null, closedLostAt: null } }),
      this.prisma.booking.count(),
      this.prisma.lead.groupBy({
        by: ['expectedValueCurrency'],
        where: { confirmedAt: null, closedLostAt: null, expectedValueAmount: { not: null } },
        _sum: { expectedValueAmount: true },
      }),
      this.prisma.enquiry.findMany({
        where: { status: EnquiryStatus.NEEDS_REPLY, firstRespondedAt: null },
        include: { slaPolicy: true },
      }),
      this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 8 }),
    ]);

    const slaBreached = breachCandidates.filter((e) => computeSla(e, e.slaPolicy).state === 'breached').length;

    const expectedRevenue = { USD: 0, INR: 0 } as Record<Currency, number>;
    for (const row of revenueByCurrency) {
      if (row.expectedValueCurrency) expectedRevenue[row.expectedValueCurrency] = row._sum.expectedValueAmount ?? 0;
    }

    return {
      metrics: {
        newEnquiries,
        needsReply,
        unassigned,
        slaBreached,
        discoveryCallsScheduled: callsScheduled,
        qualifiedOpportunities,
        confirmedBookings,
        // minor units, per-currency — never summed across currencies
        expectedRevenue,
      },
      recentActivity,
    };
  }

  /** Full analytics for the Reports screen — computed server-side, per-currency. */
  async analytics() {
    const [leads, enquiries, bookings] = await Promise.all([
      this.prisma.lead.findMany({
        select: {
          programInterest: true, expectedValueAmount: true, expectedValueCurrency: true,
          confirmedAt: true, closedLostAt: true, lostReason: { select: { label: true } },
          contact: { select: { country: true } },
        },
      }),
      this.prisma.enquiry.findMany({ select: { channel: true, leadId: true, createdAt: true, firstRespondedAt: true } }),
      this.prisma.booking.findMany({ select: { valueAmount: true, valueCurrency: true } }),
    ]);

    const tally = (rows: (string | null | undefined)[]) => {
      const m = new Map<string, number>();
      for (const r of rows) { const k = r ?? 'Unknown'; m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    const expected: Record<Currency, number> = { USD: 0, INR: 0 };
    for (const l of leads) {
      if (!l.confirmedAt && !l.closedLostAt && l.expectedValueAmount && l.expectedValueCurrency) {
        expected[l.expectedValueCurrency] += l.expectedValueAmount;
      }
    }
    const confirmed: Record<Currency, number> = { USD: 0, INR: 0 };
    for (const b of bookings) confirmed[b.valueCurrency] += b.valueAmount;

    const responded = enquiries.filter((e) => e.firstRespondedAt);
    const avgFirstResponseMins = responded.length
      ? Math.round(responded.reduce((a, e) => a + (new Date(e.firstRespondedAt!).getTime() - new Date(e.createdAt).getTime()) / 60_000, 0) / responded.length)
      : null;

    const leadsConverted = enquiries.filter((e) => e.leadId).length;

    return {
      conversion: {
        enquiries: enquiries.length,
        leads: leads.length,
        bookings: bookings.length,
        enquiryToLeadRate: enquiries.length ? Math.round((leadsConverted / enquiries.length) * 100) : 0,
        leadToBookingRate: leads.length ? Math.round((bookings.length / leads.length) * 100) : 0,
        avgFirstResponseMins,
      },
      byCountry: tally(leads.map((l) => l.contact.country)),
      byProgram: tally(leads.map((l) => l.programInterest)),
      byChannel: tally(enquiries.map((e) => e.channel)),
      lostReasons: tally(leads.filter((l) => l.closedLostAt).map((l) => l.lostReason?.label)),
      revenue: { expected, confirmed },
    };
  }

  /** Source-quality / channel funnel — counts by first-touch source. */
  async channels() {
    const byChannel = await this.prisma.enquiry.groupBy({ by: ['channel'], _count: { _all: true } });
    const converted = await this.prisma.enquiry.count({ where: { leadId: { not: null } } });
    const total = await this.prisma.enquiry.count();
    return {
      byChannel: byChannel.map((c) => ({ channel: c.channel, enquiries: c._count._all })),
      conversionToLead: { converted, total, rate: total ? Math.round((converted / total) * 100) : 0 },
    };
  }
}
