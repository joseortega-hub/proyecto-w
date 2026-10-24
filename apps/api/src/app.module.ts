import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module.js';
import { DbModule } from './db/db.module.js';
import { DomainsController } from './domains/domains.controller.js';
import { DomainsService } from './domains/domains.service.js';
import { InterviewController } from './interview/interview.controller.js';
import { InterviewService } from './interview/interview.service.js';
import { PreferencesController } from './interview/preferences.controller.js';
import { PreferencesService } from './interview/preferences.service.js';
import { SessionCleanupService } from './interview/session-cleanup.service.js';
import { QuestionBankService } from './interview/question-bank.service.js';
import { TuningService } from './interview/tuning.service.js';
import { ItemsController } from './items/items.controller.js';
import { ItemsService } from './items/items.service.js';
import { TasteController } from './taste/taste.controller.js';
import { TasteService } from './taste/taste.service.js';
import { YouTubeController } from './youtube/youtube.controller.js';
import { YouTubeService } from './youtube/youtube.service.js';

@Module({
  imports: [DbModule, AiModule],
  controllers: [DomainsController, InterviewController, ItemsController, PreferencesController, TasteController, YouTubeController],
  providers: [
    DomainsService,
    InterviewService,
    QuestionBankService,
    TuningService,
    ItemsService,
    SessionCleanupService,
    PreferencesService,
    TasteService,
    YouTubeService,
  ],
})
export class AppModule {}
