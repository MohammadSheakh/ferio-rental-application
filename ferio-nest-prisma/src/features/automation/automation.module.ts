import { Module, Global } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';

/**
 * Automation Engine Module (§ Week 32) — global so cron scans and
 * tenant feature services can fire triggers without import cycles.
 */
@Global()
@Module({
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
