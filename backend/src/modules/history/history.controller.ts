import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
  isScopedToOwnDirectorate,
} from '../../common/decorators/current-user.decorator';
import { HistoryService } from './history.service';
import { HistoryExportQueryDto, HistoryQueryDto } from './dto/history.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll(@Query() query: HistoryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.historyService.findAll(
      query,
      isScopedToOwnDirectorate(user) ? user.directorateId ?? undefined : undefined,
    );
  }

  @Get('indicators')
  getIndicators(@Query() query: HistoryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.historyService.getIndicators(
      query,
      isScopedToOwnDirectorate(user) ? user.directorateId ?? undefined : undefined,
    );
  }

  @Get('export')
  async export(
    @Query() query: HistoryExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const scopedDirectorateId = isScopedToOwnDirectorate(user)
      ? user.directorateId ?? undefined
      : undefined;

    if (query.format === 'pdf') {
      const buffer = await this.historyService.exportPdf(query, scopedDirectorateId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="historico-movimentacoes.pdf"',
      });
      res.send(buffer);
      return;
    }

    const buffer = await this.historyService.exportXlsx(query, scopedDirectorateId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="historico-movimentacoes.xlsx"',
    });
    res.send(buffer);
  }
}
