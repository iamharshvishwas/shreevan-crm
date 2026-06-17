import { Injectable } from '@nestjs/common';
import { OnboardingStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundError } from '../../common/errors/domain.errors';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.confirmedCustomer.findMany({
      include: {
        contact: { select: { name: true, country: true, timezone: true } },
        booking: {
          select: {
            valueAmount: true, valueCurrency: true, paymentStatus: true,
            lead: { select: { programInterest: true } },
            cohort: { select: { startDate: true, program: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setOnboarding(id: string, status: OnboardingStatus) {
    if (!(await this.prisma.confirmedCustomer.count({ where: { id } }))) throw new NotFoundError('Customer', id);
    return this.prisma.confirmedCustomer.update({ where: { id }, data: { onboardingStatus: status } });
  }
}
