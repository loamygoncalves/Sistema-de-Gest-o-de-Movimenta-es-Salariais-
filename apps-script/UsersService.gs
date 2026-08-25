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

var UsersService = {
  list: function () {
    return Tables.users.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  create: function (input) {
    var existing = Tables.users.findOne(function (r) {
      return r.email === input.email;
    });
    if (existing) throw new Error('Já existe um usuário com este e-mail: ' + input.email);
    if (input.role === UserRole.GESTOR && (!input.costCenterIds || input.costCenterIds.length === 0)) {
      throw new Error('Selecione ao menos um centro de custo para o Gestor.');
    }
    return Tables.users.insert({
      name: input.name,
      email: input.email,
      role: input.role,
      directorateId: input.role === UserRole.DIRETOR ? input.directorateId || '' : '',
      costCenterIds: input.role === UserRole.GESTOR ? costCenterIdsToCsv_(input.costCenterIds) : '',
      passwordSalt: '',
      passwordHash: '',
      active: true,
      createdAt: nowIso_(),
    });
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
      email: input.email,
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
    return Tables.users.update(id, patch);
  },
};
