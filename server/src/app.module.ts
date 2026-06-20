import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { PrismaModule } from './database/prisma.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { EnquiriesModule } from './modules/enquiries/enquiries.module';
import { LeadsModule } from './modules/leads/leads.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CallsModule } from './modules/calls/calls.module';
import { CustomersModule } from './modules/customers/customers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { JobsModule } from './jobs/jobs.module';
import { VedaModule } from './modules/veda/veda.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ContactsModule,
    EnquiriesModule,
    LeadsModule,
    PipelineModule,
    TasksModule,
    CallsModule,
    CustomersModule,
    NotificationsModule,
    SettingsModule,
    ReportsModule,
    JobsModule,
    VedaModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
