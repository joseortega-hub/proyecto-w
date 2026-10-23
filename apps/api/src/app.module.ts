import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module.js';
import { DbModule } from './db/db.module.js';
import { DomainsController } from './domains/domains.controller.js';
import { DomainsService } from './domains/domains.service.js';
import { InterviewController } from './interview/interview.controller.js';
import { InterviewService } from './interview/interview.service.js';
import { TuningService } from './interview/tuning.service.js';
import { ItemsController } from './items/items.controller.js';
import { ItemsService } from './items/items.service.js';

@Module({
  imports: [DbModule, AiModule],
  controllers: [DomainsController, InterviewController, ItemsController],
  providers: [DomainsService, InterviewService, TuningService, ItemsService],
})
export class AppModule {}
