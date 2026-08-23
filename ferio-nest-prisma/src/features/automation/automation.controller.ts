import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutomationTrigger } from '@prisma/tenant-client';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { ActiveMemberGuard } from '../tenant-operations/member-access.guard';

/**
 * Staff-facing CRUD + history for automation rules (§ Week 32).
 * Gated to workspace-management roles via the inventory domain.
 */
@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveMemberGuard)
@Controller('tenant/automations')
export class AutomationController {
  private db(req: any) {
    return (req as any).automationDb;
  }

  @Get('rules')
  async listRules(@Req() req: any, @Query('trigger') trigger?: AutomationTrigger) {
    const db = this.db(req);
    return db.automationRule.findMany({
      where: trigger ? { trigger } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { executions: true } } },
    });
  }

  @Post('rules')
  async createRule(
    @Req() req: any,
    @Body()
    body: {
      name: string;
      trigger: AutomationTrigger;
      action: string;
      config?: any;
    },
  ) {
    if (!body?.name?.trim() || !body.trigger || !body.action) {
      throw new BadRequestException('name, trigger and action are required');
    }
    const ctx = req.tenantContext;
    return this.db(req).automationRule.create({
      data: {
        name: body.name.trim(),
        trigger: body.trigger,
        action: body.action,
        config: body.config ?? undefined,
      },
    });
  }

  @Delete('rules/:ruleId')
  async deleteRule(@Req() req: any, @Param('ruleId') ruleId: string) {
    const db = this.db(req);
    await db.automationExecution.deleteMany({ where: { ruleId } });
    await db.automationRule.delete({ where: { id: ruleId } });
    return { deleted: true };
  }

  @Get('executions')
  async executions(
    @Req() req: any,
    @Query('trigger') trigger?: AutomationTrigger,
  ) {
    const db = this.db(req);
    return db.automationExecution.findMany({
      where: trigger ? { trigger } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Dry-run a single trigger against the workspace DB. */
  @Post('dry-run')
  async dryRun(
    @Req() req: any,
    @Body()
    body: {
      trigger: AutomationTrigger;
      refId: string;
      vars?: Record<string, string>;
    },
  ) {
    const db = this.db(req);
    const rules = await db.automationRule.findMany({
      where: { trigger: body.trigger, enabled: true },
      select: { id: true, name: true, action: true },
    });
    for (const rule of rules) {
      await db.automationExecution
        .create({
          data: {
            ruleId: rule.id,
            trigger: body.trigger,
            refId: body.refId,
            status: 'SKIPPED_DRYRUN',
            dryRun: true,
          },
        })
        .catch(() => {});
    }
    return { wouldExecute: rules.length };
  }
}
