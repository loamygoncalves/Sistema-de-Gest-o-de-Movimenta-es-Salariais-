import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
  isScopedToOwnDirectorate,
} from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private resolveDirectorateId(query: DashboardQueryDto, user: AuthenticatedUser) {
    return isScopedToOwnDirectorate(user) ? user.directorateId ?? undefined : query.directorateId;
  }

  @Get('headcount')
  getHeadcount(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getHeadcount(
      query.year,
      query.month,
      this.resolveDirectorateId(query, user),
    );
  }

  @Get('payroll')
  getPayroll(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getPayroll(
      query.year,
      query.month,
      this.resolveDirectorateId(query, user),
    );
  }

  @Get('movements')
  getMovements(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getMovements(query.year, this.resolveDirectorateId(query, user));
  }

  @Get('financial')
  getFinancial(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getFinancial(
      query.year,
      query.month,
      this.resolveDirectorateId(query, user),
    );
  }
}
