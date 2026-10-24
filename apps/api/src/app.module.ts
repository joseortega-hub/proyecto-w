import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module.js';
import { DbModule } from './db/db.module.js';
import { DomainsController } from './domains/domains.controller.js';
import { DomainsService } from './domains/domains.service.js';
import { InterviewController } from './interview/interview.controller.js';
import { AnchorsService } from './interview/anchors.service.js';
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
import { CreditsService } from './items/credits.service.js';
import { FolderController } from './folder/folder.controller.js';
import { FolderService } from './folder/folder.service.js';
import { OpsController } from './ops/ops.controller.js';
import { OpsService } from './ops/ops.service.js';
import { TraceService } from './ops/trace.service.js';
import { ThemesController } from './themes/themes.controller.js';
import { ThemesService } from './themes/themes.service.js';
import { YouTubeController } from './youtube/youtube.controller.js';
import { YouTubeService } from './youtube/youtube.service.js';

@Module({
  imports: [DbModule, AiModule],
  controllers: [DomainsController, InterviewController, ItemsController, PreferencesController, TasteController, YouTubeController, FolderController, OpsController, ThemesController],
  providers: [
    DomainsService,
    AnchorsService,
    InterviewService,
    QuestionBankService,
    TuningService,
    ItemsService,
    CreditsService,
    SessionCleanupService,
    PreferencesService,
    TasteService,
    YouTubeService,
    FolderService,
    TraceService,
    OpsService,
    ThemesService,
  ],
})
export class AppModule {}
