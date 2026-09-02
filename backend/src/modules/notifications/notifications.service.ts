import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovementStatus, UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { MovementRequest } from '../movements/entities/movement-request.entity';

const APPROVER_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  RH_REMUNERACAO: 'RH Remuneração',
  DIRETOR: 'Diretor',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PROMOCAO: 'Promoção',
  MERITO: 'Mérito',
  AUMENTO_QUADRO: 'Aumento de Quadro',
};

/**
 * Ponto único de disparo de e-mail de notificação. Dois eventos:
 *   1. notifyMovementSubmitted — nova solicitação, para Administrador, RH
 *      Remuneração, o(s) Gestor(es) do centro de custo e o Diretor da
 *      diretoria envolvida — espelha
 *      apps-script/Notifications.gs#notifyMovementSubmitted_.
 *   2. notifyMovementDecided — desfecho, só para quem solicitou: aprovada
 *      (todas as etapas) ou devolvida para ajuste (qualquer etapa recusa —
 *      volta para o solicitante com o motivo em vez de encerrar
 *      definitivamente, ver ApprovalsService#reject) — espelha
 *      apps-script/Notifications.gs#notifyMovementDecided_.
 *
 * Sem credenciais SMTP configuradas neste ambiente, o envio real ainda não
 * está implementado aqui (ao contrário do Apps Script, que envia de verdade
 * via MailApp usando a própria conta Google do deploy) — este serviço
 * resolve os destinatários, monta o assunto/corpo e registra o envio via
 * Logger, pronto para plugar um provedor de e-mail (nodemailer/SES/SendGrid)
 * bastando trocar o corpo de `send()`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async notifyMovementSubmitted(movement: MovementRequest): Promise<void> {
    try {
      const recipients = await this.resolveRecipients(movement);
      if (recipients.length === 0) return;

      const subject = `BEEP Remunera — nova solicitação: ${this.title(movement)}`;
      const body = this.buildBody(movement);

      await Promise.all(recipients.map((email) => this.send(email, subject, body)));
    } catch (err) {
      this.logger.warn(`Falha ao preparar notificação de movimentação: ${err}`);
    }
  }

  /**
   * `status` é APROVADO (todas as etapas concluídas) ou DEVOLVIDO (uma
   * etapa recusou — volta para o solicitante com `comment` como motivo).
   * `decidedByUser` é quem tomou a decisão (a última etapa, no caso de
   * aprovação).
   */
  async notifyMovementDecided(
    movement: MovementRequest,
    status: MovementStatus.APROVADO | MovementStatus.DEVOLVIDO,
    decidedByUser: AuthenticatedUser,
    comment?: string,
  ): Promise<void> {
    try {
      const to = movement.requestedBy?.email;
      if (!to) return;

      const approved = status === MovementStatus.APROVADO;
      const subject = `BEEP Remunera — solicitação ${approved ? 'aprovada' : 'devolvida para ajuste'}: ${this.title(movement)}`;
      const decidedByRoleLabel = APPROVER_ROLE_LABELS[decidedByUser.role] ?? decidedByUser.role;

      const header: [string, string | undefined][] = [
        [approved ? 'Aprovado por' : 'Devolvido por', `${decidedByUser.name} (${decidedByRoleLabel})`],
        ['Comentário', comment],
      ];
      const body =
        header
          .filter(([, value]) => value)
          .map(([label, value]) => `${label}: ${value}`)
          .join('\n') +
        '\n\n' +
        this.buildBody(movement);

      await this.send(to, subject, body);
    } catch (err) {
      this.logger.warn(`Falha ao preparar notificação de decisão de movimentação: ${err}`);
    }
  }

  /** Ponto de integração com um provedor real de e-mail (SMTP não configurado neste ambiente). */
  private async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[e-mail simulado] Para: ${to} | Assunto: ${subject}\n${body}`);
  }

  private async resolveRecipients(movement: MovementRequest): Promise<string[]> {
    const users = await this.userRepo.find({ where: { active: true }, relations: ['costCenters'] });
    const emails = new Set<string>();

    for (const user of users) {
      if (user.role === UserRole.ADMIN || user.role === UserRole.RH_REMUNERACAO) {
        emails.add(user.email);
        continue;
      }
      if (user.role === UserRole.DIRETOR) {
        if (!user.directorateId || user.directorateId === movement.directorateId) emails.add(user.email);
        continue;
      }
      if (user.role === UserRole.GESTOR) {
        const costCenterIds = (user.costCenters ?? []).map((c) => c.id);
        if (movement.costCenterId && costCenterIds.includes(movement.costCenterId)) emails.add(user.email);
      }
    }

    return Array.from(emails);
  }

  private title(movement: MovementRequest): string {
    const typeLabel = MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type;
    return movement.employee?.name ? `${typeLabel} — ${movement.employee.name}` : typeLabel;
  }

  private buildBody(movement: MovementRequest): string {
    const rows: [string, string | number | null | undefined][] = [
      ['Tipo', MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type],
      ['Colaborador', movement.employee?.name],
      ['Diretoria', movement.directorate?.name],
      ['Centro de resultado', movement.costCenter?.name],
      ['Cargo atual', movement.currentPosition?.name],
      ['Novo cargo', movement.newPosition?.name],
      ['Salário atual', movement.currentSalary],
      ['Novo salário', movement.newSalary],
      ['Percentual de mérito', movement.meritPercentage != null ? `${movement.meritPercentage}%` : null],
      ['Quantidade de vagas', movement.quantity],
      ['Salário planejado', movement.plannedSalary],
      ['Data efetiva', movement.effectiveDate],
      ['Justificativa', movement.justification],
      ['Solicitado por', movement.requestedBy?.email],
    ];

    return rows
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n');
  }
}
