import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalExpensesService } from '../services/rental-expenses.service';
import { CreateExpenseDto, ApproveExpenseDto } from '../dto/rental-expenses.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Property Expenses & Owner Accounting')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/expenses')
export class RentalExpensesController {
  constructor(private readonly expensesService: RentalExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Record a property maintenance, generator fuel, tax, or staff expense' })
  async createExpense(@Body() dto: CreateExpenseDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.expensesService.createExpense(dto, userId);
    return {
      success: true,
      message: `Expense of ৳${dto.amount} logged successfully under category '${dto.category}'.`,
      data,
    };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve or Reject a logged property expense' })
  async approveExpense(@Param('id') id: string, @Body() dto: ApproveExpenseDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.expensesService.approveExpense(id, dto, userId);
    return {
      success: true,
      message: `Expense '${id}' status updated to ${data.status}.`,
      data,
    };
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get all logged expenses for a property' })
  async getExpensesByProperty(@Param('propertyId') propertyId: string) {
    const data = await this.expensesService.getExpensesByProperty(propertyId);
    return {
      success: true,
      data,
    };
  }

  @Get('owner-summary/:ownerProfileId')
  @ApiOperation({ summary: 'Get owner net financial payout summary after management fee & expense deductions' })
  async getOwnerFinancialSummary(@Param('ownerProfileId') ownerProfileId: string) {
    const data = await this.expensesService.getOwnerFinancialSummary(ownerProfileId);
    return {
      success: true,
      data,
    };
  }
}
