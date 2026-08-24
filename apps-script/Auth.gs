/**
 * Identidade e controle de acesso — substitui o login por e-mail/senha +
 * JWT do backend original. Aqui não existe tela de login: o Web App usa a
 * conta Google de quem está acessando (Session.getActiveUser()), e o perfil
 * (role) e a diretoria de escopo vêm da aba "Usuarios".
 *
 * Importante: Session.getActiveUser().getEmail() só é confiável quando o
 * Web App é implantado com "Executar como: usuário que acessa" e acesso
 * restrito ao domínio Google Workspace da empresa (ver appsscript.json).
 * Para contas @gmail.com pessoais o Google pode não expor o e-mail por
 * privacidade — nesse caso o sistema mostra a tela de "acesso não
 * configurado" tratando o usuário como não identificado.
 */

/** Retorna {id,name,email,role,directorateId} do usuário atual, ou null se não cadastrado. */
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
  };
}

/** Lança erro se não houver usuário identificado/cadastrado. Use no início de toda função api_*. */
function requireUser_() {
  var user = getCurrentUser_();
  if (!user) {
    throw new Error(
      'ACESSO_NAO_CONFIGURADO: sua conta (' +
        (Session.getActiveUser().getEmail() || 'desconhecida') +
        ') ainda não foi cadastrada na aba Usuarios. Peça a um administrador para adicioná-la.',
    );
  }
  return user;
}

/** Lança erro se o usuário atual não tiver um dos perfis informados. */
function requireRole_(user, allowedRoles) {
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error('PERMISSAO_NEGADA: perfil ' + user.role + ' não pode executar esta ação.');
  }
}

function isScopedToOwnDirectorate_(user) {
  return SCOPED_ROLES.indexOf(user.role) !== -1;
}

/** Diretoria efetiva para filtrar consultas: a do próprio usuário se ele for escopado, senão a solicitada. */
function resolveDirectorateScope_(user, requestedDirectorateId) {
  if (isScopedToOwnDirectorate_(user)) return user.directorateId || '__nenhuma__';
  return requestedDirectorateId || null;
}
