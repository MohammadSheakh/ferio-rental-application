import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalAutomationsService } from '../services/rental-automations.service';
import { CreateAutomationRuleDto, TriggerAutomationEventDto } from '../dto/rental-automations.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Advanced Workflow Automation Engine')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/automations')
export class RentalAutomationsController {
  constructor(private readonly automationsService: RentalAutomationsService) {}

  @Post('rules')
  @ApiOperation({ summary: 'Create an automated system trigger rule (WhatsApp reminder, Task escalation, Webhook invoke)' })
  async createAutomationRule(@Body() dto: CreateAutomationRuleDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.automationsService.createAutomationRule(dto, userId);
    return {
      success: true,
      message: `Automation rule '${dto.name}' configured successfully.`,
      data,
    };
  }

  @Get('rules/:organizationId')
  @ApiOperation({ summary: 'Get all active automation rules for an organization' })
  async getRulesByOrganization(@Param('organizationId') organizationId: string) {
    const data = await this.automationsService.getRulesByOrganization(organizationId);
    return {
      success: true,
      data,
    };
  }

  @Post('trigger-event')
  @ApiOperation({ summary: 'Internal/System Event Trigger Processor for automation rule execution' })
  async processEventTrigger(@Body() dto: TriggerAutomationEventDto) {
    const data = await this.automationsService.processEventTrigger(dto);
    return {
      success: true,
      message: `Event '${dto.triggerType}' processed. ${data.matchedRulesCount} rule(s) executed.`,
      data,
    };
  }

  @Get('executions/:ruleId')
  @ApiOperation({ summary: 'Get execution history audit log for a specific automation rule' })
  async getRuleExecutionHistory(@Param('ruleId') ruleId: string) {
    const data = await this.automationsService.getRuleExecutionHistory(ruleId);
    return {
      success: true,
      data,
    };
  }
}
