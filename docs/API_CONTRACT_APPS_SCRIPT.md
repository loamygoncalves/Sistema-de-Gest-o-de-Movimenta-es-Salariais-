# Contrato do cliente Apps Script (`google.script.run`)

Todas as funções abaixo vivem em `apps-script/Api.gs` e são chamadas do
cliente (HtmlService) assim, nunca com `await`/Promise nativo:

```js
google.script.run
  .withSuccessHandler(function (result) { /* ... */ })
  .withFailureHandler(function (error) { /* error.message */ })
  .api_getDashboardHeadcount(2026, 1, null);
```

`Client_Core.html` envolve isso num helper `callApi(fnName, ...args)` que
devolve uma Promise — use-o em vez de chamar `google.script.run` direto nas
views.

Não existe login: `api_getCurrentUser()` devolve `null` se a conta Google de
quem abriu o Web App não estiver cadastrada na aba **Usuarios**; nesse caso a
tela deve mostrar um aviso de "acesso não configurado" (ver Auth.gs). Perfis
(`role`): `ADMIN`, `RH_REMUNERACAO`, `DIRETOR`, `FINANCEIRO`, `GESTOR`. Um
usuário `DIRETOR`/`GESTOR` tem `directorateId` e o backend já filtra por essa
diretoria automaticamente — o cliente não precisa (nem deve) reenviar esse
filtro para essas roles.

## Sessão / identidade
- `api_getCurrentUser()` → `{ id, name, email, role, directorateId } | null`

## Organização
- `api_getOrgLookups()` → `{ directorates[], positions[], costCenters[], managements[], coordinations[] }`
  (chame uma vez ao carregar formulários que precisem desses selects)
- `api_createDirectorate({ name, annualBudget })`, `api_updateDirectorate(id, patch)`
- `api_createManagement({ name, directorateId })`
- `api_createCoordination({ name, managementId })`
- `api_createPosition({ name, careerLevel })`, `api_updatePosition(id, patch)`
- `api_createCostCenter({ code, name, directorateId })`
- `api_importCostCenters(base64Data, mimeType, filename)` → `{ batch, totalRows, successRows, errors: [{rowNumber, field, message}] }` —
  importação em massa a partir de uma planilha com as colunas **CÓDIGO,
  CENTRO DE CUSTO e DIRETORIA** (diretoria é opcional; quando informada, é
  resolvida por nome exato). Rejeita código/nome vazio ou duplicado (na
  planilha ou já cadastrado) e diretoria informada mas inexistente.
- `api_removeCostCenter(id)` → `{ ok: true }` — exclusão definitiva (não há
  reativação; `code` é único). Lança erro se o centro de custo estiver
  referenciado no orçamento.
- `api_removeCostCenters(ids)` → `{ removed, removedIds, failed: [{id, message}] }` —
  exclusão em massa (multi-seleção); cada id é processado individualmente,
  então um id em uso no orçamento não impede a exclusão dos demais.

## Usuários (ADMIN)
- `api_listUsers()` → `[{ id, name, email, role, directorateId, active }]`
- `api_createUser({ name, email, role, directorateId })`
- `api_updateUser(id, patch)`

## Colaboradores — Módulo 2
- `api_listEmployees({ directorateId?, positionId?, status?, search? })`
- `api_getEmployee(id)`
- `api_createEmployee({ registration, name, positionId, directorateId, admissionDate, currentSalary, ... })`
- `api_updateEmployee(id, patch)`
- `api_deactivateEmployee(id)`
- `api_importEmployees(base64Data, mimeType, filename)` → `{ batch, totalRows, successRows, errors: [{rowNumber, field, message}] }`
  (o cliente lê o arquivo com `FileReader.readAsDataURL`, extrai a parte base64 após a vírgula)
- `api_getEmployeesComparison(year, month?)` → compara a base atual x orçada, agregando
  por bucket (diretoria + centro de custo + cargo) no mês de referência
  (`month` 1-12, padrão mês corrente) — o orçamento não é vinculado a
  colaborador, então a comparação não casa por matrícula:
  `{ year, month, hcBudgeted, hcCurrent, openPositions, headcountExcess, budgetSavings, budgetOverrun, movementsByType: {SEM_MOVIMENTACAO,PROMOCAO,MERITO,SUBSTITUICAO,AUMENTO_DE_QUADRO,DESLIGAMENTO}, items: [{type: 'VAGA_ABERTA'|'EXCESSO_HC', directorate, costCenter, position, budgetedCount, currentCount, budgetedCost, currentCost}] }`

## Orçamento — Módulo 1
Orçamento por **diretoria + centro de custo + cargo** — não é vinculado a
colaborador (sem matrícula/nome). Cada linha (`Tables.budgetEntries`) tem um
`movementType` (`SEM_MOVIMENTACAO | PROMOCAO | MERITO | SUBSTITUICAO |
AUMENTO_DE_QUADRO | DESLIGAMENTO`) e um custo orçado por mês (`jan`..`dez`,
`null` fora do período orçado). Múltiplas linhas podem repetir a mesma
combinação diretoria+centro de custo+cargo+tipo — cada uma representa uma
vaga/assento orçado distinto (24 linhas idênticas = 24 vagas daquele tipo);
não há rejeição de linha "duplicada" na importação.

- `api_listBudgetEntries(year, directorateId?, costCenterId?, positionId?)`
- `api_getBudgetDashboard(year, month?, directorateId?, costCenterId?)` →
  `{ year, month, hcBudgeted, payrollBudgeted, annualBudgeted }` — `hcBudgeted`/
  `payrollBudgeted` são do mês de referência (`month` 1-12, padrão mês
  corrente); `annualBudgeted` é a soma de todas as 12 colunas de todas as
  linhas (visão do ano inteiro).
- `api_importBudget(base64Data, mimeType, filename, year)` → mesmo formato de retorno do import de colaboradores.
  O `year` é sobreposto pelo ano derivado do cabeçalho de mês, quando este é
  uma data real. Reimportar substitui integralmente o orçado do ano para as
  diretorias presentes no arquivo.

## Simulador / encargos — Módulo 4
- `api_listChargeParameters()`, `api_createChargeParameter({name,label,valueType,value,isBenefit})`, `api_updateChargeParameter(id, patch)`

## Movimentações — Módulo 3
- `api_listMovements({ status?, type?, directorateId? })`
- `api_getMovement(id)` → inclui `simulation` (última simulação) e `approvalSteps`
- `api_createMovement(input)` — o corpo varia por `type`, igual ao backend original:
  - `PROMOCAO`: `{ type, employeeId, newPositionId, newSalary, effectiveDate, justification }`
  - `MERITO`: `{ type, employeeId, percentage, effectiveDate, justification }`
  - `AUMENTO_QUADRO`: `{ type, positionId, quantity, plannedSalary, directorateId, effectiveDate, justification }`
  - `TRANSFERENCIA`: `{ type, employeeId, originDirectorateId, destinationDirectorateId, newPositionId?, newSalary?, effectiveDate, justification }`
- `api_updateMovement(id, patch)` (somente RASCUNHO)
- `api_cancelMovement(id)` (somente RASCUNHO)
- `api_simulateMovement(id)` → mesmo formato do simulador do backend (`monthlySalaryImpact`, `totalAnnualImpact`, `percentConsumed`, `exceedsBudget`, `alertMessage`, ...)
- `api_submitMovement(id)` → dispara a simulação, cria as 3 etapas de aprovação e muda o status para `PENDENTE_DIRETOR`

## Aprovações — Módulo 5
- `api_getPendingApprovals()` → etapas pendentes que o usuário atual pode decidir, cada uma com `.movement` embutido
- `api_getApprovalTimeline(movementId)`
- `api_approveStep(stepId, comment?)`, `api_rejectStep(stepId, comment)` (comentário obrigatório na reprovação)

## Histórico — Módulo 6
- `api_listHistory({ directorateId?, positionId?, type?, costCenterId?, startDate?, endDate? })`
- `api_getHistoryIndicators(mesmos filtros)` → `{ promotionsCount, meritsCount, transfersCount, headcountIncreaseCount, salaryGrowthPercent, accumulatedImpact, headcountEvolution: [{month,hc}] }`
- `api_exportHistory(mesmos filtros)` → `{ spreadsheetUrl, xlsxExportUrl, pdfExportUrl }` — cria uma Google Sheet nova com os dados filtrados; o cliente deve **abrir** (`window.open`) uma dessas URLs, nunca tentar baixar via fetch (exige a sessão logada do navegador)

## Estudos salariais — Módulo 7
- `api_listSalaryStudies()`
- `api_getSalaryStudyEntries(studyId)`
- `api_importSalaryStudy(base64Data, mimeType, filename, { name, source, referenceYear })`
- `api_getSalaryPositioning({ directorateId?, positionId? })` → `[{ employee, currentSalary, marketP25, marketP50, marketP75, marketP90, classification }]`, `classification` ∈ `ABAIXO_DO_MERCADO | DENTRO_DO_MERCADO | ACIMA_DO_MERCADO | null`

## Dashboards executivos — Módulo 8
- `api_getDashboardHeadcount(year, month?, directorateId?)` → `{ year, month, hcBudgeted, hcCurrent, hcApproved, hcOpen }`
  (`hcBudgeted` é o HC orçado no mês de referência; `month` 1-12, padrão mês corrente;
  vaga em aberto = linha de orçamento com `movementType = AUMENTO_DE_QUADRO` ativa no mês)
- `api_getDashboardPayroll(year, month?, directorateId?)` → `{ year, month, payrollCurrent, payrollBudgeted, difference }`
  (ambos valores mensais — `payrollBudgeted` soma as linhas de orçamento ativas naquele mês)
- `api_getDashboardMovements(year, directorateId?)` → `{ promotions, merits, headcountIncrease, transfers }`
- `api_getDashboardFinancial(year, month?, directorateId?)` → `{ monthlyImpact, annualImpact, budgetConsumedPercent, projection12Months: [{month,impact}], directorateRanking: [{directorate,currentPayroll,annualBudget,consumedPercent}] }`

## Upload de arquivo (import)

`<input type="file">` não tem equivalente a `multipart/form-data` em
`google.script.run`. O padrão usado aqui: no cliente, ler o arquivo com
`FileReader.readAsDataURL(file)`, extrair a string base64 (depois da
vírgula em `data:<mime>;base64,<...>`), e chamar `api_importEmployees(base64,
file.type, file.name)` (ou o equivalente de orçamento/estudo salarial).
Arquivos `.xlsx` são convertidos no servidor via Google Drive (exige o
serviço avançado Drive API habilitado — ver `apps-script/README.md`);
arquivos `.csv` são lidos diretamente, sem precisar do Drive.
