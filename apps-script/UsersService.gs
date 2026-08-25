/**
 * Gestão de usuários — a identidade primária é resolvida pela conta Google
 * (ver Auth.gs); cadastrar um usuário associa um e-mail a um perfil e, para
 * DIRETOR/GESTOR, a um escopo de acesso (diretoria inteira ou uma seleção
 * de centros de custo — ver Auth.gs#resolveAccessScope_). Senha (camada
 * extra) é gerida à parte, em PasswordAuth.gs — nunca por aqui.
 */

/** "cc-1,cc-2" -> ["cc-1","cc-2"]; já espelhado em Auth.gs#parseCostCenterIds_ para leitura no boot. */
function costCenterIdsToCsv_(ids) {
  return (ids || []).filter(function (id) { return id; }).join(',');
}

/**
 * Estar na aba Usuarios não basta: o Web App roda como "USER_ACCESSING", ou
 * seja, cada pessoa lê/grava a planilha de dados com a PRÓPRIA permissão do
 * Google Drive — sem ser pelo menos Editor do arquivo, toda chamada de API
 * falha com "Você não tem permissão para acessar o documento solicitado",
 * mesmo com a linha certa na aba Usuarios. Concede Editor automaticamente
 * ao cadastrar/editar alguém para eliminar essa etapa manual. Quem está
 * chamando (o ADMIN) precisa, ele mesmo, ter permissão de compartilhar o
 * arquivo — se o Drive recusar (ex.: compartilhamento restrito, e-mail
 * inválido), não bloqueia o cadastro: devolve o problema para a tela avisar.
 */
function grantSpreadsheetAccess_(email) {
  try {
    DriveApp.getFileById(getSpreadsheetId_()).addEditor(email);
    return { granted: true };
  } catch (e) {
    return { granted: false, error: String(e && e.message ? e.message : e) };
  }
}

var UsersService = {
  list: function () {
    return Tables.users.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  create: function (input) {
    // Normaliza (trim + minúsculas) o e-mail salvo — evita que um espaço
    // colado sem querer ou uma letra maiúscula ao cadastrar impeça a
    // pessoa de entrar depois (ver Auth.gs#normalizeEmail_).
    var email = normalizeEmail_(input.email);
    var existing = Tables.users.findOne(function (r) {
      return normalizeEmail_(r.email) === email;
    });
    if (existing) throw new Error('Já existe um usuário com este e-mail: ' + email);
    if (input.role === UserRole.GESTOR && (!input.costCenterIds || input.costCenterIds.length === 0)) {
      throw new Error('Selecione ao menos um centro de custo para o Gestor.');
    }
    var created = Tables.users.insert({
      name: input.name,
      email: email,
      role: input.role,
      directorateId: input.role === UserRole.DIRETOR ? input.directorateId || '' : '',
      costCenterIds: input.role === UserRole.GESTOR ? costCenterIdsToCsv_(input.costCenterIds) : '',
      passwordSalt: '',
      passwordHash: '',
      active: true,
      createdAt: nowIso_(),
    });
    var access = grantSpreadsheetAccess_(email);
    created.driveAccessGranted = access.granted;
    if (!access.granted) created.driveAccessError = access.error;
    return created;
  },

  /**
   * Parcial: chamadas como o botão Ativar/Desativar só mandam `{active}`,
   * sem `role` — por isso o escopo (directorateId/costCenterIds) só é
   * recalculado quando `role` é de fato enviado, nunca apagado de lado
   * por uma atualização que não mexe no perfil.
   */
  update: function (id, input) {
    var patch = {
      name: input.name,
      email: input.email !== undefined ? normalizeEmail_(input.email) : undefined,
      role: input.role,
      active: input.active,
    };
    if (input.role !== undefined) {
      if (input.role === UserRole.DIRETOR) {
        patch.directorateId = input.directorateId || '';
        patch.costCenterIds = '';
      } else if (input.role === UserRole.GESTOR) {
        if (!input.costCenterIds || input.costCenterIds.length === 0) {
          throw new Error('Selecione ao menos um centro de custo para o Gestor.');
        }
        patch.directorateId = '';
        patch.costCenterIds = costCenterIdsToCsv_(input.costCenterIds);
      } else {
        patch.directorateId = '';
        patch.costCenterIds = '';
      }
    }
    Object.keys(patch).forEach(function (key) {
      if (patch[key] === undefined) delete patch[key];
    });
    var updated = Tables.users.update(id, patch);
    // Reforça o acesso à planilha a cada edição — cobre usuários cadastrados
    // antes desta correção que ainda não tinham sido compartilhados.
    var access = grantSpreadsheetAccess_(updated.email);
    updated.driveAccessGranted = access.granted;
    if (!access.granted) updated.driveAccessError = access.error;
    return updated;
  },
};
