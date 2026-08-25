/**
 * Notificação por e-mail de nova solicitação de movimentação — enviada via
 * MailApp (conta Google de quem está executando o Web App) para os
 * perfis interessados: Administrador, RH Remuneração, o(s) Gestor(es) do
 * centro de custo da movimentação e o Diretor da diretoria envolvida. Não
 * há equivalente de credencial SMTP a configurar — MailApp usa a própria
 * conta Google autorizada no deploy (ver appsscript.json, escopo
 * script.send_mail).
 *
 * Falha de envio nunca deve impedir a submissão da movimentação — por isso
 * todo o disparo é protegido por try/catch (mesmo padrão de recordAudit_
 * em Db.gs).
 */

var MOVEMENT_TYPE_LABELS_ = {
  PROMOCAO: 'Promoção',
  MERITO: 'Mérito',
  AUMENTO_QUADRO: 'Aumento de Quadro',
};

function notifyMovementSubmitted_(movement) {
  try {
    var recipients = resolveMovementNotificationRecipients_(movement);
    if (recipients.length === 0) return;

    var subject = 'BEEP Remunera — nova solicitação: ' + movementNotificationTitle_(movement);
    var body = buildMovementNotificationBody_(movement);

    recipients.forEach(function (email) {
      MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
    });
  } catch (e) {
    Logger.log('Falha ao enviar e-mails de notificação de movimentação: ' + e);
  }
}

/** Administrador e RH Remuneração sempre; Diretor da diretoria; Gestor(es) do centro de custo. */
function resolveMovementNotificationRecipients_(movement) {
  var emails = {};
  Tables.users
    .where(function (u) {
      return u.active;
    })
    .forEach(function (u) {
      if (u.role === UserRole.ADMIN || u.role === UserRole.RH_REMUNERACAO) {
        emails[u.email] = true;
        return;
      }
      if (u.role === UserRole.DIRETOR) {
        if (!u.directorateId || u.directorateId === movement.directorateId) emails[u.email] = true;
        return;
      }
      if (u.role === UserRole.GESTOR) {
        var ids = parseCostCenterIds_(u.costCenterIds);
        if (movement.costCenterId && ids.indexOf(movement.costCenterId) !== -1) emails[u.email] = true;
      }
    });
  return Object.keys(emails);
}

function movementNotificationTitle_(movement) {
  var typeLabel = MOVEMENT_TYPE_LABELS_[movement.type] || movement.type;
  return typeLabel + (movement.employeeName ? ' — ' + movement.employeeName : '');
}

function buildMovementNotificationBody_(movement) {
  var typeLabel = MOVEMENT_TYPE_LABELS_[movement.type] || movement.type;
  var rows = [];
  rows.push(['Tipo', typeLabel]);
  if (movement.employeeName) rows.push(['Colaborador', movement.employeeName]);
  rows.push(['Diretoria', movement.directorateName || '-']);
  rows.push(['Centro de custo', movement.costCenterName || '-']);
  if (movement.currentPositionName) rows.push(['Cargo atual', movement.currentPositionName]);
  if (movement.newPositionName) rows.push(['Novo cargo', movement.newPositionName]);
  if (movement.currentSalary) rows.push(['Salário atual', formatCurrencyBRL_(movement.currentSalary)]);
  if (movement.newSalary) rows.push(['Novo salário', formatCurrencyBRL_(movement.newSalary)]);
  if (movement.meritPercentage) rows.push(['Percentual de mérito', Number(movement.meritPercentage).toFixed(2) + '%']);
  if (movement.quantity) rows.push(['Quantidade de vagas', movement.quantity]);
  if (movement.plannedSalary) rows.push(['Salário planejado', formatCurrencyBRL_(movement.plannedSalary)]);
  rows.push(['Data efetiva', movement.effectiveDate]);
  rows.push(['Justificativa', movement.justification || '-']);
  rows.push(['Solicitado por', movement.requestedByEmail || '-']);

  var rowsHtml = rows
    .map(function (r) {
      return (
        '<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;">' +
        r[0] +
        '</td><td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:500;">' +
        r[1] +
        '</td></tr>'
      );
    })
    .join('');

  return (
    '<div style="font-family:Arial,sans-serif;max-width:520px;">' +
    '<h2 style="color:#0f766e;margin-bottom:4px;">Nova solicitação de movimentação salarial</h2>' +
    '<p style="color:#475569;font-size:14px;margin-top:0;">Uma nova solicitação foi submetida e aguarda aprovação. Resumo abaixo:</p>' +
    '<table style="border-collapse:collapse;">' +
    rowsHtml +
    '</table>' +
    '<p style="color:#94a3b8;font-size:12px;margin-top:24px;">Acesse o BEEP Remunera para revisar e decidir sobre esta solicitação.</p>' +
    '</div>'
  );
}

function formatCurrencyBRL_(value) {
  return 'R$ ' + Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
