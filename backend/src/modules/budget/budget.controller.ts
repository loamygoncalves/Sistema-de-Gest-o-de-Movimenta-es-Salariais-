import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
  resolveAccessScope,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { BudgetService } from './budget.service';
import {
  BudgetAdjustmentQueryDto,
  BudgetDashboardQueryDto,
  BudgetEntryQueryDto,
  SaveBudgetAdjustmentDto,
} from './dto/budget.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('entries')
  findEntries(@Query() query: BudgetEntryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.findEntries(query, resolveAccessScope(user));
  }

  @Get('dashboard')
  getDashboard(@Query() query: BudgetDashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.getDashboard(
      query.year,
      query.month,
      resolveAccessScope(user),
      query.costCenterId,
    );
  }

  /**
   * Ajuste de Orçamento (tela ADMIN) — só ADMIN vê e altera; os demais nunca
   * têm acesso a estes endpoints. Devolve todas as linhas configuradas para
   * o ano (cada uma com seu escopo — "todos", uma diretoria ou um centro de
   * resultado específico); pode haver mais de uma por ano.
   */
  @Get('adjustment')
  @Roles(UserRole.ADMIN)
  listAdjustments(@Query() query: BudgetAdjustmentQueryDto) {
    return this.budgetService.listAdjustments(query.year);
  }

  @Put('adjustment')
  @Roles(UserRole.ADMIN)
  saveAdjustment(@Body() dto: SaveBudgetAdjustmentDto) {
    return this.budgetService.saveAdjustment(dto);
  }

  @Delete('adjustment/:id')
  @Roles(UserRole.ADMIN)
  removeAdjustment(@Param('id') id: string) {
    return this.budgetService.removeAdjustment(id);
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.RH_REMUNERACAO)
  @UseInterceptors(FileInterceptor('file'))
  importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetService.importFromExcel(
      file.buffer,
      file.originalname,
      parseInt(year, 10) || new Date().getFullYear(),
      user.id,
    );
  }
}
