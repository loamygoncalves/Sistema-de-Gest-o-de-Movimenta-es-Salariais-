import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RemunerationPolicy } from './entities/remuneration-policy.entity';
import { SaveRemunerationPolicyDto } from './dto/remuneration-policy.dto';

/**
 * Política de Remuneração (tela ADMIN/RH_REMUNERACAO) — uma única linha
 * (singleton). Ver nota da entidade e `SimulatorService#checkPolicyViolations`
 * para como os limites são aplicados (nunca bloqueiam, só sinalizam).
 */
@Injectable()
export class RemunerationPolicyService {
  constructor(
    @InjectRepository(RemunerationPolicy)
    private readonly repo: Repository<RemunerationPolicy>,
  ) {}

  async get(): Promise<{
    maxMeritPercent: number | null;
    maxPromotionPercent: number | null;
    minMonthsBetweenRaises: number | null;
  }> {
    const [row] = await this.repo.find({ take: 1 });
    return {
      maxMeritPercent: row?.maxMeritPercent ?? null,
      maxPromotionPercent: row?.maxPromotionPercent ?? null,
      minMonthsBetweenRaises: row?.minMonthsBetweenRaises ?? null,
    };
  }

  async save(dto: SaveRemunerationPolicyDto) {
    let [row] = await this.repo.find({ take: 1 });
    if (!row) row = this.repo.create();
    row.maxMeritPercent = dto.maxMeritPercent ?? null;
    row.maxPromotionPercent = dto.maxPromotionPercent ?? null;
    row.minMonthsBetweenRaises = dto.minMonthsBetweenRaises ?? null;
    await this.repo.save(row);
    return this.get();
  }
}
