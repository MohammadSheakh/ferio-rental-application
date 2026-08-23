import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateAutomationRuleDto, TriggerAutomationEventDto } from '../dto/rental-automations.dto';

@Injectable()
export class RentalAutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAutomationRule(dto: CreateAutomationRuleDto, createdByUserId: string) {
    return {
      id: `rule-${Date.now()}`,
      organizationId: dto.organizationId,
      name: dto.name,
      triggerType: dto.triggerType,
      conditions: dto.conditions || {},
      actionType: dto.actionType,
      actionParams: dto.actionParams || {},
      enabled: dto.enabled,
      createdByUserId,
      createdAt: new Date(),
    };
  }

  async getRulesByOrganization(organizationId: string) {
    return [
      {
        id: 'rule-101',
        name: 'Send WhatsApp Rent Reminder 3 Days Overdue',
        triggerType: 'INVOICE_OVERDUE',
        actionType: 'SEND_WHATSAPP',
        enabled: true,
        executionsCount: 42,
      },
      {
        id: 'rule-102',
        name: 'Auto-Assign Technician on Emergency Repair Ticket',
        triggerType: 'MAINTENANCE_OPENED',
        actionType: 'CREATE_TASK',
        enabled: true,
        executionsCount: 15,
      },
    ];
  }

  async processEventTrigger(dto: TriggerAutomationEventDto) {
    const executionId = `exec-${Date.now()}`;
    return {
      executionId,
      organizationId: dto.organizationId,
      triggerType: dto.triggerType,
      matchedRulesCount: 1,
      actionsExecuted: [
        {
          ruleName: 'Send WhatsApp Rent Reminder 3 Days Overdue',
          actionType: 'SEND_WHATSAPP',
          recipient: dto.eventData?.tenantPhone || '+8801711998877',
          status: 'SUCCESS',
        },
      ],
      processedAt: new Date(),
    };
  }

  async getRuleExecutionHistory(ruleId: string) {
    return [
      {
        id: 'exec-901',
        ruleId,
        triggerEvent: 'INVOICE_OVERDUE',
        status: 'SUCCESS',
        summary: 'WhatsApp rent reminder dispatched to +8801711998877',
        executedAt: '22 Aug 2026, 09:30 AM',
      },
    ];
  }
}
