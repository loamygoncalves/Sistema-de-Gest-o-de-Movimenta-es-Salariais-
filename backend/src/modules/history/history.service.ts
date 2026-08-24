import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination-query.dto';
import { MovementType } from '../../common/enums';
import { buildExcelBuffer } from '../../common/utils/excel.util';
import { buildSimpleTablePdf } from '../../common/utils/pdf.util';
import { MovementHistory } from './entities/movement-history.entity';
import { HistoryQueryDto } from './dto/history.dto';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(MovementHistory)
    private readonly historyRepo: Repository<MovementHistory>,
  ) {}

  private buildFilteredQuery(query: HistoryQueryDto, scopedDirectorateId?: string) {
    const qb = this.historyRepo
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.employee', 'employee')
      .leftJoinAndSelect('h.directorate', 'directorate')
      .leftJoinAndSelect('h.position', 'position')
      .leftJoinAndSelect('h.costCenter', 'costCenter');
    const directorateId = scopedDirectorateId ?? query.directorateId;
    if (directorateId) qb.andWhere('h.directorateId = :directorateId', { directorateId });
    if (query.positionId) qb.andWhere('h.positionId = :positionId', { positionId: query.positionId });
    if (query.type) qb.andWhere('h.type = :type', { type: query.type });
    if (query.costCenterId) qb.andWhere('h.costCenterId = :costCenterId', { costCenterId: query.costCenterId });
    if (query.startDate) qb.andWhere('h.effectiveDate >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('h.effectiveDate <= :endDate', { endDate: query.endDate });
    return qb;
  }

  async findAll(query: HistoryQueryDto, scopedDirectorateId?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.buildFilteredQuery(query, scopedDirectorateId)
      .orderBy('h.effectiveDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async getIndicators(query: HistoryQueryDto, scopedDirectorateId?: string) {
    const records = await this.buildFilteredQuery(query, scopedDirectorateId).getMany();

    const promotionsCount = records.filter((r) => r.type === MovementType.PROMOCAO).length;
    const meritsCount = records.filter((r) => r.type === MovementType.MERITO).length;
    const accumulatedImpact = records.reduce((sum, r) => sum + Number(r.annualImpact || 0), 0);

    const salaryGrowthRecords = records.filter((r) => r.previousSalary && Number(r.previousSalary) > 0);
    const salaryGrowthPercent =
      salaryGrowthRecords.length > 0
        ? salaryGrowthRecords.reduce(
            (sum, r) => sum + ((Number(r.newSalary) - Number(r.previousSalary)) / Number(r.previousSalary)) * 100,
            0,
          ) / salaryGrowthRecords.length
        : 0;

    const headcountByMonth = new Map<string, number>();
    for (const record of records) {
      const month = record.effectiveDate.slice(0, 7); // YYYY-MM
      const delta = record.type === 'AUMENTO_QUADRO' ? 1 : 0;
      headcountByMonth.set(month, (headcountByMonth.get(month) ?? 0) + delta);
    }
    const headcountEvolution = Array.from(headcountByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, hc]) => ({ month, hc }));

    return {
      promotionsCount,
      meritsCount,
      transfersCount: records.filter((r) => r.type === MovementType.TRANSFERENCIA).length,
      headcountIncreaseCount: records.filter((r) => r.type === MovementType.AUMENTO_QUADRO).length,
      salaryGrowthPercent: Number(salaryGrowthPercent.toFixed(2)),
      accumulatedImpact,
      headcountEvolution,
    };
  }

  async exportXlsx(query: HistoryQueryDto, scopedDirectorateId?: string): Promise<Buffer> {
    const records = await this.buildFilteredQuery(query, scopedDirectorateId)
      .orderBy('h.effectiveDate', 'DESC')
      .getMany();

    return buildExcelBuffer(
      'Historico',
      [
        { header: 'Data Efetiva', key: 'effectiveDate', width: 15 },
        { header: 'Tipo', key: 'type', width: 18 },
        { header: 'Colaborador', key: 'employeeName', width: 30 },
        { header: 'Diretoria', key: 'directorateName', width: 25 },
        { header: 'Cargo', key: 'positionName', width: 25 },
        { header: 'Salário Anterior', key: 'previousSalary', width: 18 },
        { header: 'Novo Salário', key: 'newSalary', width: 18 },
        { header: 'Impacto Mensal', key: 'monthlyImpact', width: 18 },
        { header: 'Impacto Anual', key: 'annualImpact', width: 18 },
        { header: 'Aprovado em', key: 'approvedAt', width: 20 },
      ],
      records.map((r) => ({
        effectiveDate: r.effectiveDate,
        type: r.type,
        employeeName: r.employee?.name ?? '-',
        directorateName: r.directorate?.name ?? '-',
        positionName: r.position?.name ?? '-',
        previousSalary: r.previousSalary,
        newSalary: r.newSalary,
        monthlyImpact: r.monthlyImpact,
        annualImpact: r.annualImpact,
        approvedAt: r.approvedAt?.toISOString?.() ?? '',
      })),
    );
  }

  async exportPdf(query: HistoryQueryDto, scopedDirectorateId?: string): Promise<Buffer> {
    const records = await this.buildFilteredQuery(query, scopedDirectorateId)
      .orderBy('h.effectiveDate', 'DESC')
      .getMany();

    return buildSimpleTablePdf(
      'Histórico de Movimentações',
      ['Data', 'Tipo', 'Colaborador', 'Diretoria', 'Sal. Anterior', 'Novo Sal.', 'Impacto Anual'],
      records.map((r) => [
        r.effectiveDate,
        r.type,
        r.employee?.name ?? '-',
        r.directorate?.name ?? '-',
        r.previousSalary ?? '-',
        r.newSalary ?? '-',
        r.annualImpact,
      ]),
    );
  }
}
