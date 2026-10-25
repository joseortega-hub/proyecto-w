import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module.js';
import { DbModule } from './db/db.module.js';
import { DomainsController } from './domains/domains.controller.js';
import { DomainsService } from './domains/domains.service.js';
import { InterviewController } from './interview/interview.controller.js';
import { AnchorsService } from './interview/anchors.service.js';
import { NamedService } from './interview/named.service.js';
import { SourcesService } from './sources/sources.service.js';
import { SimilarService } from './interview/similar.service.js';
import { InterviewService } from './interview/interview.service.js';
import { PreferencesController } from './interview/preferences.controller.js';
import { PreferencesService } from './interview/preferences.service.js';
import { UnderstandingService } from './interview/understanding.service.js';
import { SessionCleanupService } from './interview/session-cleanup.service.js';
import { QuestionBankService } from './interview/question-bank.service.js';
import { TuningService } from './interview/tuning.service.js';
import { HomeController } from './home/home.controller.js';
import { HomeService } from './home/home.service.js';
import { RouteIntentService } from './home/route-intent.service.js';
import { StoryService } from './home/story.service.js';
import { ItemsController } from './items/items.controller.js';
import { ItemsService } from './items/items.service.js';
import { TasteController } from './taste/taste.controller.js';
import { TasteService } from './taste/taste.service.js';
import { CreditsService } from './items/credits.service.js';
import { PerreoController } from './perreo/perreo.controller.js';
import { PerreoService } from './perreo/perreo.service.js';
import { FolderController } from './folder/folder.controller.js';
import { FolderService } from './folder/folder.service.js';
import { OpsController } from './ops/ops.controller.js';
import { OpsService } from './ops/ops.service.js';
import { TraceService } from './ops/trace.service.js';
import { ThemesController } from './themes/themes.controller.js';
import { ThemesService } from './themes/themes.service.js';
import { YouTubeController } from './youtube/youtube.controller.js';
import { YouTubeService } from './youtube/youtube.service.js';
import { ListsController } from './lists/lists.controller.js';
import { ListsService } from './lists/lists.service.js';

@Module({
  imports: [DbModule, AiModule],
  controllers: [DomainsController, InterviewController, ItemsController, PreferencesController, TasteController, YouTubeController, FolderController, OpsController, ThemesController, HomeController, PerreoController, ListsController],
  providers: [
    DomainsService,
    AnchorsService,
    NamedService,
    SimilarService,
    SourcesService,
    InterviewService,
    QuestionBankService,
    TuningService,
    ItemsService,
    CreditsService,
    SessionCleanupService,
    PreferencesService,
    UnderstandingService,
    TasteService,
    YouTubeService,
    FolderService,
    PerreoService,
    TraceService,
    OpsService,
    ThemesService,
    HomeService,
    RouteIntentService,
    StoryService,
    ListsService,
  ],
})
export class AppModule {}
