import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Configuração do fluxo de aprovação (tela "Fluxo de Aprovação", ADMIN) —
 * uma sequência de etapas ordenadas por `stepOrder`; cada etapa tem um
 * conjunto de perfis (`roles`, valores de ApproverRole) e é decidida por
 * QUALQUER UM deles, o que agir primeiro. Ex.: etapa 1 = ['RH_REMUNERACAO',
 * 'ADMIN'], etapa 2 = ['DIRETOR'].
 *
 * A tabela inteira é substituída a cada salvamento (ver
 * ApprovalWorkflowService#save) — não há edição de uma etapa isolada.
 * Movimentações já submetidas não são afetadas: cada ApprovalStep guarda
 * um snapshot (`eligibleRoles`) dos perfis elegíveis no momento da
 * submissão, então mudar o fluxo aqui só vale para novas solicitações.
 */
@Entity('approval_workflow_steps')
export class ApprovalWorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'smallint', name: 'step_order' })
  stepOrder: number;

  @Column({ type: 'text', array: true })
  roles: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
