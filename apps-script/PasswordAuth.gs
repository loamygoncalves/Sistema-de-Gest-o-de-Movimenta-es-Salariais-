/**
 * Senha como camada extra sobre a identificação por conta Google — ver
 * Auth.gs para o fluxo de identificação/escopo. Hash: SHA-256(salt + ':' +
 * senha) com salt aleatório por usuário (Apps Script não tem bcrypt
 * disponível). "Sessão verificada" é por usuário-Google+script, guardada em
 * CacheService.getUserCache() (automaticamente isolado por quem está
 * acessando), com TTL de 6h (o máximo permitido pelo CacheService).
 */

var PASSWORD_SESSION_CACHE_PREFIX_ = 'pwdVerified_';
var PASSWORD_SESSION_TTL_SECONDS_ = 21600;
var PASSWORD_RATE_LIMIT_CACHE_PREFIX_ = 'pwdAttempts_';
var PASSWORD_RATE_LIMIT_MAX_ATTEMPTS_ = 5;
var PASSWORD_RATE_LIMIT_WINDOW_SECONDS_ = 300;

function hashPassword_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password);
  return bytes
    .map(function (b) {
      var v = (b + 256) % 256;
      return ('0' + v.toString(16)).slice(-2);
    })
    .join('');
}

function isPasswordVerifiedThisSession_(userId) {
  return CacheService.getUserCache().get(PASSWORD_SESSION_CACHE_PREFIX_ + userId) === '1';
}

function markPasswordVerifiedThisSession_(userId) {
  CacheService.getUserCache().put(PASSWORD_SESSION_CACHE_PREFIX_ + userId, '1', PASSWORD_SESSION_TTL_SECONDS_);
}

function clearPasswordVerificationThisSession_(userId) {
  CacheService.getUserCache().remove(PASSWORD_SESSION_CACHE_PREFIX_ + userId);
}

function checkPasswordRateLimit_(userId) {
  var attempts = Number(CacheService.getUserCache().get(PASSWORD_RATE_LIMIT_CACHE_PREFIX_ + userId) || '0');
  if (attempts >= PASSWORD_RATE_LIMIT_MAX_ATTEMPTS_) {
    throw new Error('MUITAS_TENTATIVAS: muitas tentativas de senha incorretas. Aguarde alguns minutos e tente novamente.');
  }
}

function registerPasswordFailure_(userId) {
  var cache = CacheService.getUserCache();
  var key = PASSWORD_RATE_LIMIT_CACHE_PREFIX_ + userId;
  var attempts = Number(cache.get(key) || '0') + 1;
  cache.put(key, String(attempts), PASSWORD_RATE_LIMIT_WINDOW_SECONDS_);
}

function clearPasswordFailures_(userId) {
  CacheService.getUserCache().remove(PASSWORD_RATE_LIMIT_CACHE_PREFIX_ + userId);
}

/**
 * Usuário identificado pela conta Google, mas ainda sem checar senha — usada
 * só pelas próprias funções de senha abaixo, que precisam rodar ANTES da
 * verificação exigida por requireUser_() (senão ninguém conseguiria nunca
 * cadastrar/confirmar a primeira senha).
 */
function requireIdentifiedUser_() {
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

/**
 * Define/troca a senha do usuário atual. Se ele ainda não tem senha
 * cadastrada, currentPassword é ignorado (primeiro cadastro); caso já
 * tenha, currentPassword precisa bater com a senha vigente.
 */
function api_setPassword(currentPassword, newPassword) {
  var user = requireIdentifiedUser_();
  if (!newPassword || String(newPassword).length < 6) {
    throw new Error('SENHA_INVALIDA: a senha precisa ter ao menos 6 caracteres.');
  }

  var record = Tables.users.get(user.id);
  if (record.passwordHash) {
    checkPasswordRateLimit_(user.id);
    var currentHash = hashPassword_(currentPassword || '', record.passwordSalt);
    if (currentHash !== record.passwordHash) {
      registerPasswordFailure_(user.id);
      throw new Error('SENHA_ATUAL_INCORRETA: a senha atual informada está incorreta.');
    }
  }

  var salt = Utilities.getUuid();
  var hash = hashPassword_(newPassword, salt);
  Tables.users.update(user.id, { passwordSalt: salt, passwordHash: hash });
  clearPasswordFailures_(user.id);
  markPasswordVerifiedThisSession_(user.id);
  return { ok: true };
}

/** Confirma a senha do usuário atual, liberando o acesso nesta sessão do navegador. */
function api_verifyPassword(password) {
  var user = requireIdentifiedUser_();
  var record = Tables.users.get(user.id);
  if (!record.passwordHash) {
    throw new Error('SENHA_NAO_CADASTRADA: esta conta ainda não tem senha cadastrada.');
  }

  checkPasswordRateLimit_(user.id);
  var hash = hashPassword_(password || '', record.passwordSalt);
  if (hash !== record.passwordHash) {
    registerPasswordFailure_(user.id);
    throw new Error('SENHA_INCORRETA: senha incorreta.');
  }

  clearPasswordFailures_(user.id);
  markPasswordVerifiedThisSession_(user.id);
  return { ok: true };
}

/**
 * Encerra a sessão de senha do usuário atual nesta sessão do navegador — a
 * identidade da conta Google continua ativa, mas a próxima chamada de
 * qualquer outra api_* volta a exigir SENHA_NAO_VERIFICADA (ver
 * requireUser_ em Auth.gs), levando de volta à tela de senha
 * (Client_Core.html#renderPasswordGate).
 */
function api_logout() {
  var user = requireIdentifiedUser_();
  clearPasswordVerificationThisSession_(user.id);
  return { ok: true };
}

/** Admin: define/reseta a senha de outro usuário (ex.: usuário esqueceu a senha). */
function api_adminSetUserPassword(targetUserId, newPassword) {
  var user = requireUser_();
  requireRole_(user, [UserRole.ADMIN]);
  if (!newPassword || String(newPassword).length < 6) {
    throw new Error('SENHA_INVALIDA: a senha precisa ter ao menos 6 caracteres.');
  }
  var target = Tables.users.get(targetUserId);
  if (!target) throw new Error('Usuário não encontrado: ' + targetUserId);

  var salt = Utilities.getUuid();
  var hash = hashPassword_(newPassword, salt);
  Tables.users.update(targetUserId, { passwordSalt: salt, passwordHash: hash });
  clearPasswordFailures_(targetUserId);
  clearPasswordVerificationThisSession_(targetUserId);
  recordAudit_(user.email, 'RESET_PASSWORD', 'users', targetUserId, {});
  return { ok: true };
}
