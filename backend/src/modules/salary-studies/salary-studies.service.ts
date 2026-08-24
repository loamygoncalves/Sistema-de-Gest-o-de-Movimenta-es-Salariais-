import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportType, MarketPosition } from '../../common/enums';
import { parseExcelBuffer, toNumber } from '../../common/utils/excel.util';
import { OrgService } from '../org/org.service';
import { ImportBatchService } from '../imports/import-batch.service';
import { Employee } from '../employees/entities/employee.entity';
import { SalaryStudy } from './entities/salary-study.entity';
import { SalaryStudyEntry } from './entities/salary-study-entry.entity';
import { ImportSalaryStudyDto, PositioningQueryDto } from './dto/salary-study.dto';

@Injectable()
export class SalaryStudiesService {
  constructor(
    @InjectRepository(SalaryStudy)
    private readonly studyRepo: Repository<SalaryStudy>,
    @InjectRepository(SalaryStudyEntry)
    private readonly entryRepo: Repository<SalaryStudyEntry>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly orgService: OrgService,
    private readonly importBatchService: ImportBatchService,
  ) {}

  findAll() {
    return this.studyRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findEntries(studyId: string) {
    const study = await this.studyRepo.findOne({ where: { id: studyId } });
    if (!study) throw new NotFoundException('Estudo salarial não encontrado');
    return this.entryRepo.find({ where: { studyId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Importa uma pesquisa salarial de mercado a partir de uma planilha Excel.
   * Colunas esperadas (normalizadas): cargo, empresa, salario_minimo,
   * salario_medio, salario_maximo, percentil_25, percentil_50, percentil_75,
   * percentil_90.
   */
  async importFromExcel(
    buffer: Buffer,
    filename: string,
    dto: ImportSalaryStudyDto,
    importedById: string,
  ) {
    const batch = await this.importBatchService.create(
      ImportType.ESTUDO_SALARIAL,
      filename,
      importedById,
      dto.referenceYear,
    );

    const study = await this.studyRepo.save(
      this.studyRepo.create({
        name: dto.name,
        source: dto.source,
        referenceYear: dto.referenceYear,
        importedById,
        importBatchId: batch.id,
      }),
    );

    const rows = await parseExcelBuffer(buffer);
    const errors: { rowNumber: number; field?: string; message: string }[] = [];
    let successRows = 0;

    for (const row of rows) {
      const data = row.data;
      const positionName = String(data['cargo'] ?? '').trim();
      if (!positionName) {
        errors.push({ rowNumber: row.rowNumber, field: 'cargo', message: 'Cargo é obrigatório' });
        continue;
      }
      const position = await this.orgService.findPositionByName(positionName);
      if (!position) {
        errors.push({ rowNumber: row.rowNumber, field: 'cargo', message: `Cargo inexistente: ${positionName}` });
        continue;
      }

      await this.entryRepo.save(
        this.entryRepo.create({
          studyId: study.id,
          positionId: position.id,
          companyName: data['empresa'] ? String(data['empresa']) : undefined,
          minSalary: toNumber(data['salario_minimo']) ?? undefined,
          avgSalary: toNumber(data['salario_medio']) ?? undefined,
          maxSalary: toNumber(data['salario_maximo']) ?? undefined,
          p25: toNumber(data['percentil_25']) ?? undefined,
          p50: toNumber(data['percentil_50']) ?? undefined,
          p75: toNumber(data['percentil_75']) ?? undefined,
          p90: toNumber(data['percentil_90']) ?? undefined,
        }),
      );
      successRows += 1;
    }

    await this.importBatchService.finish(batch.id, rows.length, successRows, errors);
    return this.studyRepo.findOneOrFail({ where: { id: study.id } });
  }

  /**
   * Compara o salário atual dos colaboradores com o mercado, usando a média
   * das entradas de estudo salarial para o mesmo cargo (todas as fontes/anos
   * disponíveis). Classificação por faixa de percentil: abaixo do P25 =
   * abaixo do mercado; acima do P75 = acima do mercado; caso contrário,
   * dentro do mercado.
   */
  async getPositioning(query: PositioningQueryDto, scopedDirectorateId?: string) {
    const employeeQb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.position', 'position')
      .leftJoinAndSelect('e.directorate', 'directorate');

    const directorateId = scopedDirectorateId ?? query.directorateId;
    if (directorateId) employeeQb.andWhere('e.directorateId = :directorateId', { directorateId });
    if (query.positionId) employeeQb.andWhere('e.positionId = :positionId', { positionId: query.positionId });

    const employees = await employeeQb.getMany();
    if (employees.length === 0) return [];

    const positionIds = [...new Set(employees.map((e) => e.positionId))];
    const entries = await this.entryRepo
      .createQueryBuilder('entry')
      .where('entry.positionId IN (:...positionIds)', { positionIds })
      .getMany();

    const marketByPosition = new Map<
      string,
      { p25: number; p50: number; p75: number; p90: number; count: number }
    >();
    for (const entry of entries) {
      const acc = marketByPosition.get(entry.positionId) ?? { p25: 0, p50: 0, p75: 0, p90: 0, count: 0 };
      acc.p25 += Number(entry.p25 ?? 0);
      acc.p50 += Number(entry.p50 ?? 0);
      acc.p75 += Number(entry.p75 ?? 0);
      acc.p90 += Number(entry.p90 ?? 0);
      acc.count += 1;
      marketByPosition.set(entry.positionId, acc);
    }

    return employees.map((employee) => {
      const market = marketByPosition.get(employee.positionId);
      if (!market || market.count === 0) {
        return {
          employee: {
            id: employee.id,
            name: employee.name,
            registration: employee.registration,
            positionId: employee.positionId,
            positionName: employee.position?.name,
            directorateId: employee.directorateId,
            directorateName: employee.directorate?.name,
          },
          currentSalary: employee.currentSalary,
          marketP25: null,
          marketP50: null,
          marketP75: null,
          marketP90: null,
          classification: null,
        };
      }

      const p25 = market.p25 / market.count;
      const p50 = market.p50 / market.count;
      const p75 = market.p75 / market.count;
      const p90 = market.p90 / market.count;

      let classification: MarketPosition;
      if (employee.currentSalary < p25) classification = MarketPosition.ABAIXO_DO_MERCADO;
      else if (employee.currentSalary > p75) classification = MarketPosition.ACIMA_DO_MERCADO;
      else classification = MarketPosition.DENTRO_DO_MERCADO;

      return {
        employee: {
          id: employee.id,
          name: employee.name,
          registration: employee.registration,
          positionId: employee.positionId,
          positionName: employee.position?.name,
          directorateId: employee.directorateId,
          directorateName: employee.directorate?.name,
        },
        currentSalary: employee.currentSalary,
        marketP25: Number(p25.toFixed(2)),
        marketP50: Number(p50.toFixed(2)),
        marketP75: Number(p75.toFixed(2)),
        marketP90: Number(p90.toFixed(2)),
        classification,
      };
    });
  }
}
