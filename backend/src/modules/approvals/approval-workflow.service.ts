import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
import { ApprovalWorkflowStepDto } from './dto/approval-workflow.dto';

@Injectable()
export class ApprovalWorkflowService {
  constructor(
    @InjectRepository(ApprovalWorkflowStep)
    private readonly workflowRepo: Repository<ApprovalWorkflowStep>,
  ) {}

  async list(): Promise<ApprovalWorkflowStep[]> {
    return this.workflowRepo.find({ order: { stepOrder: 'ASC' } });
  }

  /**
   * Substitui o fluxo inteiro — não há edição de uma etapa isolada, a ordem
   * do array define `stepOrder`. Movimentações já submetidas não são
   * afetadas (cada ApprovalStep guarda o snapshot dos perfis elegíveis no
   * momento da submissão).
   */
  async replace(steps: ApprovalWorkflowStepDto[]): Promise<ApprovalWorkflowStep[]> {
    if (!steps || steps.length === 0) {
      throw new BadRequestException('O fluxo de aprovação precisa ter ao menos uma etapa.');
    }

    await this.workflowRepo.clear();
    const entities = steps.map((step, index) =>
      this.workflowRepo.create({ stepOrder: index + 1, roles: step.roles }),
    );
    return this.workflowRepo.save(entities);
  }
}
