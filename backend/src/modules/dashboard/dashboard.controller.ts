import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
  resolveAccessScope,
} from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('headcount')
  getHeadcount(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getHeadcount(
      query.year,
      query.month,
      resolveAccessScope(user),
      query.directorateId,
      query.costCenterId,
    );
  }

  @Get('payroll')
  getPayroll(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getPayroll(
      query.year,
      query.month,
      resolveAccessScope(user),
      query.directorateId,
      query.costCenterId,
    );
  }

  @Get('movements')
  getMovements(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getMovements(
      query.year,
      resolveAccessScope(user),
      query.directorateId,
      query.costCenterId,
    );
  }

  @Get('financial')
  getFinancial(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getFinancial(
      query.year,
      query.month,
      resolveAccessScope(user),
      query.directorateId,
      query.costCenterId,
    );
  }
}
