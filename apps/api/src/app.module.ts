import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AccessRequestsModule } from './access-requests/access-requests.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BasicCheckReasonsModule } from './basic-check-reasons/basic-check-reasons.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { CuratorsModule } from './curators/curators.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthController } from './health/health.controller.js';
import { ImportModule } from './import/import.module.js';
import { OverviewModule } from './overview/overview.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { SubmittersModule } from './submitters/submitters.module.js';
import { UsersModule } from './users/users.module.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../../../.env'),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api/{*splat}'],
    }),
    PrismaModule,
    AuthModule,
    EventsModule,
    ImportModule,
    SubmissionsModule,
    SubmittersModule,
    ReviewsModule,
    UsersModule,
    OverviewModule,
    CommentsModule,
    BasicCheckReasonsModule,
    CuratorsModule,
    AccessRequestsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
