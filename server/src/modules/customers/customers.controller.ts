import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OnboardingStatus } from '@prisma/client';
import { CustomersService } from './customers.service';

class OnboardingDto { @IsEnum(OnboardingStatus) status!: OnboardingStatus; }

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list() {
    return this.customers.list();
  }

  @Post(':id/onboarding')
  setOnboarding(@Param('id') id: string, @Body() dto: OnboardingDto) {
    return this.customers.setOnboarding(id, dto.status);
  }
}
