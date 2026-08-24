/**
 * Camada exposta ao cliente HtmlService via google.script.run — equivalente
 * aos controllers REST do backend NestJS original (ver
 * docs/API_CONTRACT_APPS_SCRIPT.md para o contrato completo). Toda função
 * aqui é responsável por: (1) resolver/exigir o usuário atual, (2) checar
 * o perfil quando a ação é restrita, e (3) devolver dados já "limpos"
 * (sem o campo interno `_row`) para o cliente.
 *
 * Convenção: em caso de erro, a função lança (throw); o cliente sempre
 * chama via .withFailureHandler(...) para tratar isso (ver
 * Client_Core.html).
 */

/**
 * Lazy on purpose: Apps Script concatena todos os .gs em um único escopo e
 * executa o código de nível superior de cada arquivo, na ordem em que os
 * arquivos aparecem no projeto, antes de qualquer função ser chamada. Como
 * essa ordem segue o nome do arquivo (Api.gs vem antes de Enums.gs), uma
 * atribuição direta aqui (`var MANAGE_ROLES_ = [UserRole.ADMIN, ...]`)
 * lançaria "Cannot read properties of undefined" na primeira execução do
 * projeto, pois UserRole ainda não existiria. Uma função adia a leitura de
 * UserRole para o momento da chamada, quando todos os arquivos já carregaram.
 */
function manageRoles_() {
  return [UserRole.ADMIN, UserRole.RH_REMUNERACAO];
}

function stripRow_(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  var copy = shallowCopy_(obj);
  delete copy._row;
  return copy;
}

function stripRows_(list) {
  return (list || []).map(stripRow_);
}

/** Usado pela tela inicial: não lança erro, devolve null se não identificado. */
function api_getCurrentUser() {
  return getCurrentUser_();
}

// ---------------------------------------------------------------------------
// Organização
// ---------------------------------------------------------------------------

function api_getOrgLookups() {
  requireUser_();
  return {
    directorates: stripRows_(OrgService.listDirectorates()),
    positions: stripRows_(OrgService.listPositions()),
    costCenters: stripRows_(OrgService.listCostCenters()),
    managements: stripRows_(OrgService.listManagements(null)),
    coordinations: stripRows_(OrgService.listCoordinations(null)),
  };
}

function api_createDirectorate(input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(OrgService.createDirectorate(input));
}

function api_updateDirectorate(id, input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(OrgService.updateDirectorate(id, input));
}

function api_createManagement(input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(OrgService.createManagement(input));
}

function api_createCoordination(input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(OrgService.createCoordination(input));
}

function api_createPosition(input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(OrgService.createPosition(input));
}

function api_updatePosition(id, input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(OrgService.updatePosition(id, input));
}

function api_createCostCenter(input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(OrgService.createCostCenter(input));
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

function api_listUsers() {
  var user = requireUser_();
  requireRole_(user, [UserRole.ADMIN]);
  return stripRows_(UsersService.list());
}

function api_createUser(input) {
  var user = requireUser_();
  requireRole_(user, [UserRole.ADMIN]);
  var created = stripRow_(UsersService.create(input));
  recordAudit_(user.email, 'CREATE', 'users', created.id, input);
  return created;
}

function api_updateUser(id, input) {
  var user = requireUser_();
  requireRole_(user, [UserRole.ADMIN]);
  var updated = stripRow_(UsersService.update(id, input));
  recordAudit_(user.email, 'UPDATE', 'users', id, input);
  return updated;
}

// ---------------------------------------------------------------------------
// Colaboradores (Módulo 2)
// ---------------------------------------------------------------------------

function api_listEmployees(filters) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : null;
  return stripRows_(EmployeesService.list(filters || {}, scoped));
}

function api_getEmployee(id) {
  requireUser_();
  return stripRow_(EmployeesService.get(id));
}

function api_createEmployee(input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  var created = stripRow_(EmployeesService.create(input));
  recordAudit_(user.email, 'CREATE', 'employees', created.id, input);
  return created;
}

function api_updateEmployee(id, input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(EmployeesService.update(id, input));
}

function api_deactivateEmployee(id) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(EmployeesService.deactivate(id));
}

function api_importEmployees(base64Data, mimeType, filename) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return EmployeesService.importFromFile(base64Data, mimeType, filename, user.email);
}

function api_getEmployeesComparison(year, month) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : null;
  return EmployeesService.compareWithBudget(year, month, scoped);
}

// ---------------------------------------------------------------------------
// Orçamento (Módulo 1)
// ---------------------------------------------------------------------------

function api_listBudgetEntries(year, directorateId, costCenterId, positionId) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : directorateId;
  return stripRows_(BudgetService.listEntries(year, scoped, costCenterId, positionId));
}

function api_getBudgetDashboard(year, month, directorateId, costCenterId) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : directorateId;
  return BudgetService.getDashboard(year, month, scoped, costCenterId);
}

function api_importBudget(base64Data, mimeType, filename, year) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return BudgetService.importFromFile(base64Data, mimeType, filename, year, user.email);
}

// ---------------------------------------------------------------------------
// Simulador / encargos (Módulo 4)
// ---------------------------------------------------------------------------

function api_listChargeParameters() {
  requireUser_();
  return stripRows_(ChargeParametersService.list());
}

function api_createChargeParameter(input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(ChargeParametersService.create(input));
}

function api_updateChargeParameter(id, input) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return stripRow_(ChargeParametersService.update(id, input));
}

// ---------------------------------------------------------------------------
// Movimentações (Módulo 3) + Simulador (Módulo 4)
// ---------------------------------------------------------------------------

function api_listMovements(filters) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : null;
  return stripRows_(MovementsService.list(filters || {}, scoped));
}

function api_getMovement(id) {
  requireUser_();
  var movement = MovementsService.get(id);
  movement.simulation = stripRow_(movement.simulation);
  movement.approvalSteps = stripRows_(movement.approvalSteps);
  return stripRow_(movement);
}

function api_createMovement(input) {
  var user = requireUser_();
  var created = stripRow_(MovementsService.create(input, user));
  recordAudit_(user.email, 'CREATE', 'movement_requests', created.id, input);
  return created;
}

function api_updateMovement(id, input) {
  requireUser_();
  return stripRow_(MovementsService.update(id, input));
}

function api_cancelMovement(id) {
  var user = requireUser_();
  recordAudit_(user.email, 'CANCEL', 'movement_requests', id, {});
  return stripRow_(MovementsService.cancel(id));
}

function api_simulateMovement(id) {
  requireUser_();
  return stripRow_(MovementsService.simulate(id));
}

function api_submitMovement(id) {
  var user = requireUser_();
  var result = MovementsService.submit(id);
  recordAudit_(user.email, 'SUBMIT', 'movement_requests', id, {});
  result.simulation = stripRow_(result.simulation);
  result.approvalSteps = stripRows_(result.approvalSteps);
  return stripRow_(result);
}

// ---------------------------------------------------------------------------
// Aprovações (Módulo 5)
// ---------------------------------------------------------------------------

function api_getPendingApprovals() {
  var user = requireUser_();
  return stripRows_(ApprovalsService.findPending(user)).map(function (step) {
    step.movement = stripRow_(step.movement);
    return step;
  });
}

function api_getApprovalTimeline(movementId) {
  requireUser_();
  return stripRows_(ApprovalsService.timeline(movementId));
}

function api_approveStep(stepId, comment) {
  var user = requireUser_();
  return stripRow_(ApprovalsService.approve(stepId, user, comment));
}

function api_rejectStep(stepId, comment) {
  var user = requireUser_();
  return stripRow_(ApprovalsService.reject(stepId, user, comment));
}

// ---------------------------------------------------------------------------
// Histórico (Módulo 6)
// ---------------------------------------------------------------------------

function api_listHistory(filters) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : null;
  return stripRows_(HistoryService.list(filters || {}, scoped));
}

function api_getHistoryIndicators(filters) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : null;
  return HistoryService.getIndicators(filters || {}, scoped);
}

function api_exportHistory(filters) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : null;
  return HistoryService.exportToSheet(filters || {}, scoped);
}

// ---------------------------------------------------------------------------
// Estudos salariais (Módulo 7)
// ---------------------------------------------------------------------------

function api_listSalaryStudies() {
  requireUser_();
  return stripRows_(SalaryStudiesService.list());
}

function api_getSalaryStudyEntries(studyId) {
  requireUser_();
  return stripRows_(SalaryStudiesService.getEntries(studyId));
}

function api_importSalaryStudy(base64Data, mimeType, filename, meta) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  var result = SalaryStudiesService.importFromFile(base64Data, mimeType, filename, meta, user.email);
  result.study = stripRow_(result.study);
  return result;
}

function api_getSalaryPositioning(filters) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : null;
  return SalaryStudiesService.getPositioning(filters || {}, scoped);
}

// ---------------------------------------------------------------------------
// Dashboards executivos (Módulo 8)
// ---------------------------------------------------------------------------

function api_getDashboardHeadcount(year, month, directorateId) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : directorateId;
  return DashboardService.getHeadcount(year, month, scoped);
}

function api_getDashboardPayroll(year, month, directorateId) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : directorateId;
  return DashboardService.getPayroll(year, month, scoped);
}

function api_getDashboardMovements(year, directorateId) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : directorateId;
  return DashboardService.getMovements(year, scoped);
}

function api_getDashboardFinancial(year, month, directorateId) {
  var user = requireUser_();
  var scoped = isScopedToOwnDirectorate_(user) ? user.directorateId : directorateId;
  return DashboardService.getFinancial(year, month, scoped);
}
