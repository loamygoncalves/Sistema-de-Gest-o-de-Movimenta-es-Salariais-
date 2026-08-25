/**
 * Camada exposta ao cliente HtmlService via google.script.run — equivalente
 * aos controllers REST do backend NestJS original (ver
 * docs/API_CONTRACT_APPS_SCRIPT.md para o contrato completo). Toda função
 * aqui é responsável por: (1) resolver/exigir o usuário atual, (2) checar
 * o perfil quando a ação é restrita, (3) mesclar o escopo de acesso do
 * usuário com os filtros explícitos vindos da UI (ver
 * Auth.gs#resolveAccessScope_/mergeAccessScope_) e (4) devolver dados já
 * "limpos" (sem o campo interno `_row`) para o cliente.
 *
 * Convenção: em caso de erro, a função lança (throw); o cliente sempre
 * chama via .withFailureHandler(...) para tratar isso (ver
 * Client_Core.html). Funções de senha (api_setPassword, api_verifyPassword,
 * api_adminSetUserPassword) ficam em PasswordAuth.gs, não aqui.
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
  delete copy.passwordSalt;
  delete copy.passwordHash;
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

function api_importCostCenters(base64Data, mimeType, filename) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return OrgService.importCostCentersFromFile(base64Data, mimeType, filename, user.email);
}

function api_removeCostCenter(id) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  OrgService.removeCostCenter(id);
  return { ok: true };
}

function api_removeCostCenters(ids) {
  var user = requireUser_();
  requireRole_(user, manageRoles_());
  return OrgService.removeCostCenters(ids);
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
  filters = filters || {};
  var scope = mergeAccessScope_(resolveAccessScope_(user), filters.directorateId, filters.costCenterId);
  return stripRows_(EmployeesService.list(filters, scope));
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
  var scope = resolveAccessScope_(user);
  return EmployeesService.compareWithBudget(year, month, scope);
}

// ---------------------------------------------------------------------------
// Orçamento (Módulo 1)
// ---------------------------------------------------------------------------

function api_listBudgetEntries(year, directorateId, costCenterId, positionId) {
  var user = requireUser_();
  var scope = mergeAccessScope_(resolveAccessScope_(user), directorateId, costCenterId);
  return stripRows_(BudgetService.listEntries(year, scope, positionId));
}

function api_getBudgetDashboard(year, month, directorateId, costCenterId) {
  var user = requireUser_();
  var scope = mergeAccessScope_(resolveAccessScope_(user), directorateId, costCenterId);
  return BudgetService.getDashboard(year, month, scope);
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

/**
 * Simulador rápido (Módulo 4) — Gestor/Diretor testa o impacto de uma
 * promoção/mérito para um de seus colaboradores antes de abrir a
 * solicitação de fato. Não persiste nada (nem Movimentacoes, nem
 * Simulacoes) — é só uma prévia. Espelha
 * backend/src/modules/simulator/simulator.controller.ts#preview.
 */
function api_previewSimulation(input) {
  var user = requireUser_();
  input = input || {};

  if (input.type !== MovementType.PROMOCAO && input.type !== MovementType.MERITO) {
    throw new Error('Simulação rápida só está disponível para promoção ou mérito');
  }

  var employee = Tables.employees.get(input.employeeId);
  if (!employee) throw new Error('Colaborador não encontrado');

  var scope = resolveAccessScope_(user);
  if (!matchesAccessScope_(employee, scope)) {
    throw new Error('PERMISSAO_NEGADA: colaborador fora do seu escopo de acesso.');
  }

  if (input.type === MovementType.PROMOCAO) {
    if (!input.newPositionId) throw new Error('Novo cargo é obrigatório');
    if (input.newSalary === undefined || input.newSalary === null) throw new Error('Novo salário é obrigatório');
    if (Number(input.newSalary) < Number(employee.currentSalary)) {
      throw new Error('Promoção não pode ter novo salário inferior ao salário atual do colaborador');
    }
    return SimulatorService.simulate({
      type: MovementType.PROMOCAO,
      directorateId: employee.directorateId,
      costCenterId: employee.costCenterId,
      currentSalary: Number(employee.currentSalary),
      newSalary: Number(input.newSalary),
      effectiveDate: input.effectiveDate,
    });
  }

  if (!input.percentage || Number(input.percentage) <= 0) {
    throw new Error('Percentual de mérito deve ser maior que zero');
  }
  return SimulatorService.simulate({
    type: MovementType.MERITO,
    directorateId: employee.directorateId,
    costCenterId: employee.costCenterId,
    currentSalary: Number(employee.currentSalary),
    meritPercentage: Number(input.percentage),
    effectiveDate: input.effectiveDate,
  });
}

// ---------------------------------------------------------------------------
// Movimentações (Módulo 3) + Simulador (Módulo 4)
// ---------------------------------------------------------------------------

function api_listMovements(filters) {
  var user = requireUser_();
  filters = filters || {};
  var scope = mergeAccessScope_(resolveAccessScope_(user), filters.directorateId, filters.costCenterId);
  return stripRows_(MovementsService.list(filters, scope));
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

function api_getApprovalWorkflow() {
  requireUser_();
  return ApprovalWorkflowService.list();
}

function api_saveApprovalWorkflow(steps) {
  var user = requireUser_();
  requireRole_(user, [UserRole.ADMIN]);
  var result = ApprovalWorkflowService.replace(steps);
  recordAudit_(user.email, 'UPDATE', 'approval_workflow_steps', '', { steps: steps });
  return result;
}

// ---------------------------------------------------------------------------
// Histórico (Módulo 6)
// ---------------------------------------------------------------------------

function api_listHistory(filters) {
  var user = requireUser_();
  filters = filters || {};
  var scope = mergeAccessScope_(resolveAccessScope_(user), filters.directorateId, filters.costCenterId);
  return stripRows_(HistoryService.list(filters, scope));
}

function api_getHistoryIndicators(filters) {
  var user = requireUser_();
  filters = filters || {};
  var scope = mergeAccessScope_(resolveAccessScope_(user), filters.directorateId, filters.costCenterId);
  return HistoryService.getIndicators(filters, scope);
}

function api_exportHistory(filters) {
  var user = requireUser_();
  filters = filters || {};
  var scope = mergeAccessScope_(resolveAccessScope_(user), filters.directorateId, filters.costCenterId);
  return HistoryService.exportToSheet(filters, scope);
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
  filters = filters || {};
  var scope = mergeAccessScope_(resolveAccessScope_(user), filters.directorateId, filters.costCenterId);
  return SalaryStudiesService.getPositioning(filters, scope);
}

// ---------------------------------------------------------------------------
// Dashboards executivos (Módulo 8)
// ---------------------------------------------------------------------------

function api_getDashboardHeadcount(year, month, directorateId, costCenterId) {
  var user = requireUser_();
  var scope = mergeAccessScope_(resolveAccessScope_(user), directorateId, costCenterId);
  return DashboardService.getHeadcount(year, month, scope);
}

function api_getDashboardPayroll(year, month, directorateId, costCenterId) {
  var user = requireUser_();
  var scope = mergeAccessScope_(resolveAccessScope_(user), directorateId, costCenterId);
  return DashboardService.getPayroll(year, month, scope);
}

function api_getDashboardMovements(year, directorateId, costCenterId) {
  var user = requireUser_();
  var scope = mergeAccessScope_(resolveAccessScope_(user), directorateId, costCenterId);
  return DashboardService.getMovements(year, scope);
}

function api_getDashboardFinancial(year, month, directorateId, costCenterId) {
  var user = requireUser_();
  var scope = mergeAccessScope_(resolveAccessScope_(user), directorateId, costCenterId);
  return DashboardService.getFinancial(year, month, scope);
}
