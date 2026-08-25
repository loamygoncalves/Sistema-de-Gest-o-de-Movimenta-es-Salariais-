import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
  resolveAccessScope,
} from '../../common/decorators/current-user.decorator';
import { HistoryService } from './history.service';
import { HistoryExportQueryDto, HistoryQueryDto } from './dto/history.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll(@Query() query: HistoryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.historyService.findAll(query, resolveAccessScope(user));
  }

  @Get('indicators')
  getIndicators(@Query() query: HistoryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.historyService.getIndicators(query, resolveAccessScope(user));
  }

  @Get('export')
  async export(
    @Query() query: HistoryExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const scope = resolveAccessScope(user);

    if (query.format === 'pdf') {
      const buffer = await this.historyService.exportPdf(query, scope);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="historico-movimentacoes.pdf"',
      });
      res.send(buffer);
      return;
    }

    const buffer = await this.historyService.exportXlsx(query, scope);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="historico-movimentacoes.xlsx"',
    });
    res.send(buffer);
  }
}
