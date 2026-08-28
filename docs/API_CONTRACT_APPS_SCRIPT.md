# Contrato do cliente Apps Script (`google.script.run`)

Todas as funções abaixo vivem em `apps-script/Api.gs` e são chamadas do
cliente (HtmlService) assim, nunca com `await`/Promise nativo:

```js
google.script.run
  .withSuccessHandler(function (result) { /* ... */ })
  .withFailureHandler(function (error) { /* error.message */ })
  .api_getDashboardHeadcount(2026, [1], null);
```

`Client_Core.html` envolve isso num helper `callApi(fnName, ...args)` que
devolve uma Promise — use-o em vez de chamar `google.script.run` direto nas
views.

A identidade primária continua sendo a conta Google de quem abriu o Web App:
`api_getCurrentUser()` devolve `null` se ela não estiver cadastrada na aba
**Usuarios**; nesse caso a tela deve mostrar um aviso de "acesso não
configurado" (ver Auth.gs). Por cima disso, quem tem uma senha cadastrada
(coluna `passwordHash` da aba Usuarios) precisa também confirmá-la nesta
sessão do navegador antes de usar o resto da API — ver seção **Senha
(camada extra)** abaixo; toda função `api_*` (exceto as listadas ali) lança
`SENHA_NAO_VERIFICADA` até isso acontecer.

Perfis (`role`): `ADMIN`, `RH_REMUNERACAO`, `DIRETOR`, `GESTOR`. `DIRETOR`
tem `directorateId` e enxerga toda a diretoria; `GESTOR` tem `costCenterIds`
(multi-seleção) e enxerga só os colaboradores/orçamento desses centros de
custo (lista vazia = não vê nada — nunca "vê tudo" por omissão). GESTOR
nunca aprova movimentações, só solicita. O servidor resolve esse escopo a
partir do usuário identificado
(`resolveAccessScope_`/`mergeAccessScope_`/`matchesAccessScope_` em Auth.gs)
e aplica automaticamente — filtros `directorateId`/`costCenterId` enviados
pelo cliente só valem para quem não tem escopo restrito.

## Sessão / identidade
- `api_getCurrentUser()` → `{ id, name, email, role, directorateId, costCenterIds, hasPassword, passwordVerified } | null`

## Senha (camada extra)
Sem credenciais SMTP ou provedor de identidade próprio, a senha aqui é só
uma camada extra sobre a conta Google — ver `apps-script/PasswordAuth.gs`.
Estas três funções podem ser chamadas mesmo com `passwordVerified: false`
(são elas que liberam o resto da API):
- `api_setPassword(currentPassword, newPassword)` → `{ ok: true }` — cadastra
  (primeiro acesso, `currentPassword` ignorado) ou troca a própria senha
  (mínimo 6 caracteres); já marca a sessão como verificada.
- `api_verifyPassword(password)` → `{ ok: true }` — confirma a senha
  cadastrada para liberar o acesso nesta sessão do navegador (~6h). Limitado
  a 5 tentativas incorretas por 5 minutos (`MUITAS_TENTATIVAS`).
- `api_adminSetUserPassword(targetUserId, newPassword)` (ADMIN) → `{ ok: true }` —
  redefine a senha de outro usuário (ex.: esqueceu a senha).
- `api_logout()` → `{ ok: true }` — encerra a sessão de senha do usuário atual
  nesta sessão do navegador (limpa o cache de `passwordVerified`); a
  identidade da conta Google continua ativa, mas a próxima ação exige senha
  de novo (`SENHA_NAO_VERIFICADA`), levando de volta à tela de senha. Botão
  "Sair" no topbar (`Client_Core.html#renderShell`) chama isso e re-executa
  `boot()`.

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
- `api_listUsers()` → `[{ id, name, email, role, directorateId, costCenterIds, active }]`
  (`costCenterIds` é uma string CSV de ids, ex. `"cc-1,cc-2"`; senha nunca é devolvida)
- `api_createUser({ name, email, role, directorateId? })` (DIRETOR) ou
  `api_createUser({ name, email, role, costCenterIds: string[] })` (GESTOR —
  obrigatório ao menos 1 id); demais perfis não enviam nenhum dos dois.
- `api_updateUser(id, patch)` — mesmas regras de `directorateId`/`costCenterIds`
  acima quando `patch.role` é enviado; um patch parcial sem `role` (ex.: o
  botão Ativar/Desativar manda só `{ active }`) preserva o escopo já
  cadastrado. Redefinir senha é uma chamada separada, `api_adminSetUserPassword`.

  Como o Web App roda como `USER_ACCESSING` (cada pessoa lê/grava a planilha
  de dados com a própria permissão do Google Drive), `api_createUser` e
  `api_updateUser` também tentam conceder automaticamente acesso de Editor
  à planilha de dados para o e-mail cadastrado (`DriveApp...addEditor`) —
  sem isso, a pessoa cai em "Você não tem permissão para acessar o documento
  solicitado" mesmo estando certa na aba Usuarios. Isso só funciona se quem
  está chamando (o ADMIN logado) também tiver permissão de compartilhar o
  arquivo; se o Drive recusar, a resposta inclui `driveAccessGranted: false`
  e `driveAccessError` — a UI avisa e a planilha precisa ser compartilhada
  manualmente com essa pessoa.

## Colaboradores — Módulo 2
- `api_listEmployees({ directorateId?, positionId?, status?, search? })`
- `api_getEmployee(id)`
- `api_createEmployee({ registration, name, positionId, directorateId, admissionDate, currentSalary, ... })`
- `api_updateEmployee(id, patch)`
- `api_deactivateEmployee(id)`
- `api_importEmployees(base64Data, mimeType, filename)` — **fechamento mensal da folha**.
  Colunas esperadas (normalizadas): `matricula, nome, cargo, centro_de_custo, admissao,
  salario_atual, mes_de_referencia`. `mes_de_referencia` é `MM/AAAA` (ex.: `08/2026`) — o
  mês que está sendo fechado, lido linha a linha (não um parâmetro do arquivo inteiro); a
  diretoria é derivada do centro de custo informado (não é mais uma coluna própria — o
  centro de custo precisa já ter uma diretoria vinculada em Estrutura Organizacional). Além
  de atualizar `employees.currentSalary`/`employees.costCenterId` de cada colaborador (como
  sempre), grava um snapshot do mês de cada linha na aba `FechamentoFolha` — reimportar o
  mesmo (year, month) substitui o snapshot anterior de cada colaborador, nunca duplica.
  Quando este fechamento avança o mês mais recente da folha (não é uma correção de um mês
  antigo), qualquer colaborador que estava `ATIVO` e tinha snapshot no fechamento anterior
  mas não aparece nesta planilha é automaticamente marcado `INATIVO` (sinal de que saiu da
  empresa entre um mês e outro); reimportar um mês antigo nunca dispara isso.
  Retorna `{ batch, totalRows, successRows, errors: [{rowNumber, field, message}], deactivated: [{id, registration, name}] }`
  (`deactivated` lista quem foi inativado automaticamente nesta importação — vazio na
  maioria das vezes; o cliente lê o arquivo com `FileReader.readAsDataURL`, extrai a parte
  base64 após a vírgula)
- `api_getEmployeesComparison(year, month?)` → compara a base x orçada, agregando por
  centro de custo (nunca por cargo — sempre diretoria + centro de custo) no mês de
  referência (`month` 1-12, padrão mês corrente). O lado "atual" usa **exclusivamente** o
  snapshot de fechamento do mês exato pedido (ver `api_importEmployees` acima) — nunca o
  salário atual ao vivo. Sem fechamento para o mês pedido,
  `hcCurrent`/`budgetSavings`/`budgetOverrun` vêm zerados e `monthClosed: false`; usar o
  salário atual faria um mês sem fechamento "herdar" os números do último mês fechado, como
  se as folhas tivessem sido somadas entre meses. O orçamento não é vinculado a
  colaborador, então a comparação não casa por matrícula:
  `{ year, month, hcBudgeted, hcCurrent, openPositions, headcountExcess, budgetSavings, budgetOverrun, movementsByType: {SEM_MOVIMENTACAO,PROMOCAO,MERITO,SUBSTITUICAO,AUMENTO_DE_QUADRO,DESLIGAMENTO}, items: [{type: 'VAGA_ABERTA'|'EXCESSO_HC', directorate, costCenter, budgetedCount, currentCount, budgetedCost, currentCost}], monthClosed }`

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
- `api_getBudgetAdjustment(year)` (ADMIN) → `{ year, percent }` (100 se nunca
  ajustado). `api_saveBudgetAdjustment(year, percent)` (ADMIN) → mesmo
  formato — Ajuste de Orçamento (tela ADMIN, aba `AjusteOrcamento`): um
  percentual por ano (ex.: 90) que reduz/aumenta proporcionalmente todo
  "orçado" em R$ exibido no sistema (`api_getBudgetDashboard`, Dashboard,
  Simulador, `EmployeesService.compareWithBudget`) sem alterar os valores
  originais na aba `Orcamento` — o fator é aplicado só na leitura, nunca
  gravado sobre a fonte. Não afeta contagem de HC/vagas orçadas, só valores
  monetários. Sem ajuste salvo para o ano, o fator é 100% (sem efeito). Só
  ADMIN tem acesso a estas funções — os demais perfis nunca veem o
  percentual, apenas os valores já ajustados nas outras funções.

## Simulador / encargos — Módulo 4
- `api_listChargeParameters()`, `api_createChargeParameter({name,label,valueType,value,isBenefit})`, `api_updateChargeParameter(id, patch)`
- `api_previewSimulation({ employeeId, type: 'PROMOCAO'|'MERITO', newPositionId?, newSalary?, effectiveDate })` —
  **Simulador Rápido**: Gestor/Diretor testam o impacto de uma promoção/mérito
  para um de seus colaboradores ANTES de abrir a solicitação de fato; não
  persiste nada (nem `Movimentacoes`, nem `Simulacoes`). `newPositionId` só
  para `PROMOCAO`; `newSalary` é obrigatório para os dois — em `MERITO` o
  percentual é calculado a partir dele (mesma UX da Promoção). Retorna o
  mesmo formato de `api_simulateMovement` abaixo. Lança `PERMISSAO_NEGADA` se
  o colaborador estiver fora do escopo de acesso do usuário.
- `api_getRemunerationPolicy()` (qualquer autenticado) → `{ maxMeritPercent,
  maxPromotionPercent, minMonthsBetweenRaises }` (cada campo `number | null`
  — `null` = sem limite configurado). `api_saveRemunerationPolicy({
  maxMeritPercent, maxPromotionPercent, minMonthsBetweenRaises })` (ADMIN,
  RH_REMUNERACAO) mesmo formato de retorno — Política de Remuneração (tela
  "Política de Remuneração", aba PoliticaRemuneracao): limites globais
  opcionais usados por `policyViolations` (ver `api_simulateMovement`
  abaixo). Uma única linha (singleton); nunca bloqueia
  simulação/submissão, só alimenta a sinalização.

## Movimentações — Módulo 3
Transferência foi descontinuada (não existe mais como `type`). Toda
movimentação tem um `costCenterId`: em `PROMOCAO`/`MERITO` é herdado do
colaborador; em `AUMENTO_QUADRO` é informado na solicitação (obrigatório).

- `api_listMovements({ status?, type?, directorateId?, costCenterId? })`
- `api_getMovement(id)` → inclui `simulation` (última simulação) e `approvalSteps`
- `api_createMovement(input)` — o corpo varia por `type`, igual ao backend original:
  - `PROMOCAO`: `{ type, employeeId, newPositionId, newSalary, effectiveDate, justification }`
  - `MERITO`: `{ type, employeeId, newSalary, effectiveDate, justification }` — igual à Promoção,
    informa-se o novo salário; o servidor calcula e persiste `meritPercentage` automaticamente
    (`newSalary` precisa ser maior que o salário atual do colaborador)
  - `AUMENTO_QUADRO`: `{ type, positionId, quantity, plannedSalary, directorateId, costCenterId, effectiveDate, justification }`
- `api_updateMovement(id, patch)` (somente RASCUNHO)
- `api_cancelMovement(id)` (somente RASCUNHO)
- `api_simulateMovement(id)` → recalcula e persiste a simulação; retorna
  `{ monthsRemaining, monthlySalaryImpact, annualSalaryImpact, chargesTotal,
  benefitsTotal, totalMonthlyImpact, totalAnnualImpact,
  budgetedDirectoratePayroll, currentDirectoratePayroll, payrollAfterApproval,
  difference, percentConsumed, exceedsBudget, alertMessage,
  salaryIncreasePercent, policyViolations }`. Apesar do nome dos campos (herdado do modelo
  original), a comparação é sempre pelo **centro de custo exato** (diretoria
  + centro de custo) da movimentação — nunca pelo orçamento da diretoria
  inteira, e nunca restrita ao cargo específico da movimentação.

  `currentDirectoratePayroll` e `payrollAfterApproval` usam **exclusivamente**
  o fechamento da folha (aba FechamentoFolha) desse centro de custo — nunca
  `employees.currentSalary` ao vivo:
  - `currentDirectoratePayroll` = soma real (não anualizada) de todos os
    meses já fechados no ano da data efetiva da movimentação (ex.: soma de
    jan a ago se ago for o último fechamento).
  - `payrollAfterApproval` = `currentDirectoratePayroll` + uma projeção dos
    meses que faltam até dezembro: pega o total do **último mês fechado**
    para esse centro de custo, soma o `totalMonthlyImpact` da movimentação
    (o novo "ritmo mensal" após a mudança) e multiplica pelos meses
    restantes no ano a partir da data efetiva (`monthsRemaining`) — não é
    `currentDirectoratePayroll + totalAnnualImpact` simples, que ignoraria
    o histórico real acumulado do centro de custo.
  - Quando a data efetiva está mais de um mês à frente do último
    fechamento (ex.: fechamento até agosto, movimentação em 01/11), os
    meses de lacuna entre os dois (setembro, outubro) replicam o total do
    último mês fechado **sem** o `totalMonthlyImpact` (ainda não é o novo
    ritmo) e somam a `payrollAfterApproval` — do contrário esses meses
    ficariam de fora da projeção inteira. A partir do mês da data efetiva,
    a projeção volta a usar o último fechamento + impacto normalmente.
  - `percentConsumed`/`exceedsBudget`/`difference` comparam esse
    `payrollAfterApproval` projetado (ano inteiro) contra
    `budgetedDirectoratePayroll` (orçamento anual) — é o que permite ao
    gestor saber, ao simular, se a movimentação estoura ou não o orçamento
    do ano.
  - Sem nenhum fechamento no ano da data efetiva, tudo vem zerado (nunca
    herda o cadastro ao vivo nem o fechamento de outro ano).

  `policyViolations` (`string[]`, vazio = aderente) sinaliza — **nunca
  bloqueia** — quando a movimentação (Mérito ou Promoção; Aumento de
  Quadro não gera violação) foge da Política de Remuneração:
  `salaryIncreasePercent` acima do limite do tipo, ou menos meses do que
  `minMonthsBetweenRaises` desde o último Mérito/Promoção desse
  colaborador na aba Historico. As mensagens ficam salvas na coluna
  `policyViolations` de Simulacoes (uma por linha, dentro da célula),
  visíveis tanto para quem simula/solicita quanto para quem vai aprovar.
- `api_submitMovement(id)` → dispara a simulação, cria uma etapa de aprovação por
  linha do fluxo configurado (ver seção Aprovações abaixo), muda o status para
  `PENDENTE_APROVACAO` e envia um e-mail de notificação (via `MailApp`, de
  verdade) para ADMIN, RH_REMUNERACAO, o(s) GESTOR(es) do centro de custo e o
  DIRETOR da diretoria — ver `apps-script/Notifications.gs`.

  Todos os e-mails do sistema (nova solicitação e decisão, ver seção
  Aprovações) usam o mesmo cartão com a logo Beep e as cores da marca
  (teal) no cabeçalho, um botão de acesso ao Web App
  (`ScriptApp.getService().getUrl()`) e resumo da movimentação — o e-mail
  de decisão soma quem decidiu, um selo verde/vermelho conforme
  aprovada/reprovada e o comentário do aprovador, quando houver. Falha de
  envio nunca bloqueia a ação que o originou (protegido por try/catch).

## Aprovações — Módulo 5
O fluxo de aprovação é configurável (ADMIN, tela Fluxo de Aprovação): uma
sequência de etapas ordenadas, cada uma com um conjunto de perfis
elegíveis — **qualquer um deles decide a etapa** (o que agir primeiro), não
todos. `movementRequests.status` fica em `PENDENTE_APROVACAO` (genérico)
durante todo o fluxo; a etapa "ativa" é a de menor `stepOrder` ainda
`PENDENTE`. GESTOR nunca aprova, só solicita.

- `api_getApprovalWorkflow()` → lista as etapas configuradas: `[{ id, stepOrder, roles }]`
- `api_saveApprovalWorkflow(steps)` (ADMIN) — `steps: [{ roles }]` → substitui o fluxo inteiro
  (a ordem do array define `stepOrder`); não afeta movimentações já submetidas (cada etapa
  guarda um snapshot de `eligibleRoles` no momento da submissão)
- `api_getPendingApprovals()` → etapas pendentes que o usuário atual pode decidir (perfil está
  em `eligibleRoles` da etapa ativa), cada uma com `.movement` embutido
- `api_getApprovalTimeline(movementId)` → cada etapa com `{ id, stepOrder, eligibleRoles,
  decidedByRole, status, approverEmail, comment, decidedAt }`
- `api_approveStep(stepId, comment?)` — se essa era a última etapa pendente, a movimentação
  vira `APROVADO` e um e-mail de decisão é enviado ao solicitante (ver seção Notificações)
- `api_rejectStep(stepId, comment)` (comentário obrigatório na reprovação) — reprova a
  movimentação, pula as demais etapas e envia o e-mail de decisão ao solicitante

## Histórico — Módulo 6
- `api_listHistory({ directorateId?, positionId?, type?, costCenterId?, startDate?, endDate? })`
- `api_getHistoryIndicators(mesmos filtros)` → `{ promotionsCount, meritsCount, headcountIncreaseCount, salaryGrowthPercent, accumulatedImpact, headcountEvolution: [{month,hc}] }`
- `api_exportHistory(mesmos filtros)` → `{ spreadsheetUrl, xlsxExportUrl, pdfExportUrl }` — cria uma Google Sheet nova com os dados filtrados; o cliente deve **abrir** (`window.open`) uma dessas URLs, nunca tentar baixar via fetch (exige a sessão logada do navegador)

## Estudos salariais — Módulo 7
- `api_listSalaryStudies()`
- `api_getSalaryStudyEntries(studyId)`
- `api_importSalaryStudy(base64Data, mimeType, filename, { name, source, referenceYear })`
- `api_getSalaryPositioning({ directorateId?, positionId? })` → `[{ employee, currentSalary, marketP25, marketP50, marketP75, marketP90, classification }]`, `classification` ∈ `ABAIXO_DO_MERCADO | DENTRO_DO_MERCADO | ACIMA_DO_MERCADO | null`

## Dashboards executivos — Módulo 8
Todas as funções abaixo (exceto `api_getDashboardMovements`, sempre anual)
recebem `months` como um **array** de 1-12 (`[7]` ou `[7,8,9]`; padrão: só o
mês corrente) — o Dashboard Executivo permite selecionar vários meses de
uma vez e ver o dashboard refletir exatamente o período escolhido, em vez
de só um mês por vez. **Custo (folha) é somado entre os meses selecionados**
(gasto acumulado do período); **headcount é a média** (não é aditivo).
Selecionar os 12 meses dá a visão "acumulado do ano".

- `api_getDashboardHeadcount(year, months?, directorateId?)` →
  `{ year, months, hcBudgeted, hcCurrent, hcApproved, hcOpen, monthClosed, openMonths, byMonth: [{month, hcBudgeted, hcCurrent, hcOpen, monthClosed}] }`
  (`hcBudgeted`/`hcCurrent`/`hcOpen` são a média entre os meses selecionados; `hcApproved` é
  sempre anual; vaga em aberto = linha de orçamento com `movementType = AUMENTO_DE_QUADRO`
  ativa no mês)
- `api_getDashboardPayroll(year, months?, directorateId?)` →
  `{ year, months, payrollCurrent, payrollBudgeted, difference, monthClosed, openMonths, byMonth: [{month, payrollBudgeted, payrollCurrent, monthClosed}] }`
  (`payrollCurrent`/`payrollBudgeted` são a SOMA entre os meses selecionados — gasto
  acumulado do período)
  `hcCurrent`/`payrollCurrent` de cada mês usam **exclusivamente** o fechamento de folha
  daquele mês exato (aba `FechamentoFolha`) — nunca o `currentSalary` ao vivo. Mês sem
  fechamento entra zerado (não "herda" os números de outro mês fechado) e aparece em
  `openMonths`; `monthClosed` só é `true` quando TODOS os meses selecionados estão fechados.
- `api_getDashboardCostCenters(year, months?, directorateId?)` →
  `{ year, months, items: [{ directorateId, directorateName, costCenterId, costCenterName, budgetedCost, currentCost, difference, budgetedCount, currentCount, status }] }`
  Orçado x Atual por centro de custo, somando o custo e mediando o headcount entre os meses
  selecionados — é o que permite a uma diretoria (filtro `directorateId`) ver exatamente quais
  dos seus centros de custo estão `DENTRO` ou `ACIMA` do orçamento no período escolhido.
  `difference = currentCost - budgetedCost`; ordenado do maior estouro para a maior economia.
- `api_getDashboardMovements(year, directorateId?)` → `{ promotions, merits, headcountIncrease }`
- `api_getDashboardFinancial(year, months?, directorateId?)` →
  `{ months, monthlyImpact, annualImpact, budgetConsumedPercent, annualPayrollProjection: [{month,value,closed,budgeted,overBudget}], directorateRanking: [{directorate,currentPayroll,annualBudget,consumedPercent}], monthClosed, openMonths }`
  (`monthClosed`/`openMonths` refletem os mesmos meses usados em `budgetConsumedPercent`,
  herdados de `api_getDashboardPayroll`)
  `annualPayrollProjection` é a folha do ano inteiro (`year`), jan-dez, um
  item por mês (`month` 1-12): para meses já fechados, `value` é o
  fechamento real da folha somado (`closed: true`); para meses ainda sem
  fechamento, `value` projeta a partir do **último mês fechado** somando o
  impacto mensal de toda movimentação já `APROVADO` cujo `effectiveDate`
  caia depois desse último fechamento — o impacto entra no mês de
  vigência e persiste nos meses seguintes (`closed: false`), a mesma
  lógica de lacuna usada em `payrollAfterApproval` do Simulador. Sem
  nenhum fechamento no ano, os meses abertos partem de zero.
  `budgeted` é a soma do orçado (aba Orçamento) daquele mês, já com o
  fator de **Ajuste de Orçamento** do ano aplicado (mesmo cálculo de
  `payrollBudgeted` em `api_getDashboardPayroll`); `overBudget` é `true`
  quando `value > budgeted` (`budgeted > 0`), tanto para meses fechados
  (estouro real) quanto projetados (estouro projetado) — usado para
  sinalizar a barra em vermelho no gráfico.
  `directorateRanking.currentPayroll` usa **exclusivamente** o fechamento da folha (aba
  FechamentoFolha) dos meses selecionados, somado — nunca `employees.currentSalary` ao vivo
  (que reflete o salário mais recente de cada colaborador, não o de um mês fechado
  específico) e não é mais anualizado (× 12); mesma semântica de "Folha Atual" da seção de
  Folha de Pagamento, só que quebrada por diretoria. `directorateRanking` vem **vazio (`[]`)**
  para GESTOR (identificado por `scope.costCenterIds` presente) — esse comparativo abrange
  todas as diretorias da empresa, então não faz parte do escopo de um gestor restrito a
  alguns centros de custo.

## Upload de arquivo (import)

`<input type="file">` não tem equivalente a `multipart/form-data` em
`google.script.run`. O padrão usado aqui: no cliente, ler o arquivo com
`FileReader.readAsDataURL(file)`, extrair a string base64 (depois da
vírgula em `data:<mime>;base64,<...>`), e chamar `api_importEmployees(base64,
file.type, file.name)` (ou o equivalente de orçamento/estudo salarial).
Arquivos `.xlsx` são convertidos no servidor via Google Drive (exige o
serviço avançado Drive API habilitado — ver `apps-script/README.md`);
arquivos `.csv` são lidos diretamente, sem precisar do Drive.
