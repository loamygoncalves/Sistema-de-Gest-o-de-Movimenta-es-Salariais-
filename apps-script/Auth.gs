/**
 * Identidade e controle de acesso — substitui o login por e-mail/senha +
 * JWT do backend original. A identidade primária ainda é a conta Google de
 * quem está acessando (Session.getActiveUser()); por cima dela, quem tem
 * uma senha cadastrada (aba "Usuarios", coluna passwordHash) precisa também
 * confirmá-la nesta sessão do navegador antes de liberar o app — ver
 * PasswordAuth.gs para a verificação/definição da senha e
 * Client_Core.html para a tela de senha.
 *
 * Importante: Session.getActiveUser().getEmail() só é confiável quando o
 * Web App é implantado com "Executar como: usuário que acessa" e acesso
 * restrito ao domínio Google Workspace da empresa (ver appsscript.json).
 * Para contas @gmail.com pessoais o Google pode não expor o e-mail por
 * privacidade — nesse caso o sistema mostra a tela de "acesso não
 * configurado" tratando o usuário como não identificado.
 */

/** Retorna {id,name,email,role,directorateId,costCenterIds,hasPassword,passwordVerified} do usuário atual, ou null se não cadastrado. */
function getCurrentUser_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) return null;

  var record = Tables.users.findOne(function (r) {
    return r.email === email && r.active;
  });
  if (!record) return null;

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    directorateId: record.directorateId || null,
    costCenterIds: parseCostCenterIds_(record.costCenterIds),
    hasPassword: !!record.passwordHash,
    // Senha agora é obrigatória para todo mundo (não é "verificada por
    // omissão" para quem ainda não cadastrou uma) — ver
    // Client_Core.html#renderPasswordGate, que mostra a tela de cadastro
    // (mode 'set') quando hasPassword é false.
    passwordVerified: !!record.passwordHash && isPasswordVerifiedThisSession_(record.id),
  };
}

function parseCostCenterIds_(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
}

/**
 * Lança erro se não houver usuário identificado/cadastrado, ou se ele tiver
 * senha cadastrada mas ainda não a confirmou nesta sessão do navegador.
 * Use no início de toda função api_* (exceto api_getCurrentUser e as de
 * verificação de senha, que precisam rodar antes dessa checagem).
 */
function requireUser_() {
  var user = getCurrentUser_();
  if (!user) {
    throw new Error(
      'ACESSO_NAO_CONFIGURADO: sua conta (' +
        (Session.getActiveUser().getEmail() || 'desconhecida') +
        ') ainda não foi cadastrada na aba Usuarios. Peça a um administrador para adicioná-la.',
    );
  }
  if (!user.passwordVerified) {
    throw new Error('SENHA_NAO_VERIFICADA: confirme sua senha para continuar.');
  }
  return user;
}

/** Lança erro se o usuário atual não tiver um dos perfis informados. */
function requireRole_(user, allowedRoles) {
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error('PERMISSAO_NEGADA: perfil ' + user.role + ' não pode executar esta ação.');
  }
}

/**
 * Escopo de acesso do usuário: DIRETOR enxerga a diretoria inteira, GESTOR
 * enxerga só os centros de custo atribuídos a ele, os demais perfis (ADMIN,
 * RH_REMUNERACAO, FINANCEIRO) não têm escopo restrito. Nunca os dois campos
 * ao mesmo tempo. Espelha
 * backend/src/common/decorators/current-user.decorator.ts#resolveAccessScope.
 */
function resolveAccessScope_(user) {
  if (user.role === UserRole.DIRETOR) {
    return user.directorateId ? { directorateId: user.directorateId } : {};
  }
  if (user.role === UserRole.GESTOR) {
    return { costCenterIds: user.costCenterIds || [] };
  }
  return {};
}

/**
 * Testa se um registro (com colunas directorateId/costCenterId) está dentro
 * do escopo de acesso do usuário. Um Gestor sem centro de custo atribuído
 * não vê nada (nunca "vê tudo" por omissão).
 */
function matchesAccessScope_(record, scope) {
  if (scope.directorateId && record.directorateId !== scope.directorateId) return false;
  if (scope.costCenterIds) {
    if (scope.costCenterIds.length === 0) return false;
    if (scope.costCenterIds.indexOf(record.costCenterId) === -1) return false;
  }
  return true;
}

/**
 * Combina o escopo do usuário com filtros explícitos vindos da UI
 * (directorateId/costCenterId escolhidos em um <select>) — mesma regra do
 * applyAccessScope() do backend NestJS: o escopo do usuário sempre vence
 * quando definido; o filtro explícito só é considerado para quem não tem
 * escopo restrito (ADMIN/RH_REMUNERACAO/FINANCEIRO).
 */
function mergeAccessScope_(scope, queryDirectorateId, queryCostCenterId) {
  var merged = {};
  if (scope.directorateId || queryDirectorateId) {
    merged.directorateId = scope.directorateId || queryDirectorateId;
  }
  if (scope.costCenterIds) {
    merged.costCenterIds = scope.costCenterIds;
  } else if (queryCostCenterId) {
    merged.costCenterIds = [queryCostCenterId];
  }
  return merged;
}
