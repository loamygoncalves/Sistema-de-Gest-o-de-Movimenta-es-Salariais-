# Contrato de API — Backend NestJS

Base URL: `http://localhost:3001/api`. Todas as rotas (exceto `/auth/login`)
exigem header `Authorization: Bearer <jwt>`. Respostas de erro seguem o formato
padrão do Nest: `{ statusCode, message, error }`.

Perfis (`role`): `ADMIN`, `RH_REMUNERACAO`, `DIRETOR`, `GESTOR`.
`DIRETOR` tem `directorateId` e enxerga toda a diretoria; `GESTOR` tem
`costCenterIds` (multi-seleção) e enxerga só os colaboradores/orçamento
desses centros de resultado (lista vazia = não vê nada — nunca "vê tudo" por
omissão). `ADMIN`/`RH_REMUNERACAO` não têm escopo restrito. GESTOR nunca
aprova movimentações — só solicita. O backend resolve esse escopo a partir do token
(`resolveAccessScope`/`applyAccessScope`) e aplica automaticamente em toda
consulta filtrável por diretoria/centro de resultado — filtros de query string
(`directorateId`/`costCenterId`) só valem para quem não tem escopo restrito.

## Auth
- `POST /auth/login` `{ email, password }` → `{ accessToken, user: { id, name, email, role, directorateId, costCenterIds } }`
- `GET /auth/me` → usuário autenticado

## Organização (ADMIN, RH_REMUNERACAO: escrita; demais: leitura)
- `GET/POST /directorates`, `GET/PATCH/DELETE /directorates/:id`
- `GET/POST /managements`, `GET/PATCH/DELETE /managements/:id` (`?directorateId=`)
- `GET/POST /coordinations` (`?managementId=`)
- `GET/POST /positions`, `GET/PATCH/DELETE /positions/:id`
- `GET/POST /cost-centers`
- `POST /cost-centers/import` (multipart `file`) — importação em massa a partir de uma
  planilha com as colunas **CÓDIGO, CENTRO DE RESULTADO e DIRETORIA** (aceita
  também o cabeçalho legado CENTRO DE CUSTO; diretoria é
  opcional; quando informada, é resolvida por nome exato). Rejeita código/nome
  vazio ou duplicado (na planilha ou já cadastrado) e diretoria informada mas
  inexistente. Retorna `ImportBatch` (mesmo formato abaixo).
- `GET /cost-centers/import/:batchId`
- `DELETE /cost-centers/:id` — exclusão definitiva (não há reativação; `code` é
  único). Centros de resultado referenciados no orçamento não podem ser excluídos
  (FK RESTRICT em `budget_entries.cost_center_id`) — retorna 400 nesse caso.
- `DELETE /cost-centers` `{ ids: string[] }` — exclusão em massa (multi-seleção).
  Cada id é processado individualmente: ids referenciados no orçamento falham
  sem impedir a exclusão dos demais. Retorna
  `{ removed: number, removedIds: string[], failed: [{ id, message }] }`.
- `GET/POST /users` (ADMIN only), `PATCH /users/:id`, `PATCH /users/:id/password`.
  `POST`/`PATCH` body: `{ name, email, role, directorateId? }` (DIRETOR) ou
  `{ name, email, role, costCenterIds: string[] }` (GESTOR — obrigatório ao
  menos 1 id); demais perfis não enviam nenhum dos dois.

## Employees (base atual) — módulo 2
- `GET /employees?directorateId=&positionId=&status=&search=&page=&limit=`
- `GET /employees/:id`
- `POST /employees` / `PATCH /employees/:id` / `DELETE /employees/:id`
- `POST /employees/import` (multipart `file`) — **fechamento mensal da folha**. Colunas
  esperadas (normalizadas): `matricula, nome, cargo, centro_de_resultado, admissao,
  salario_atual, mes_de_referencia`. `mes_de_referencia` é `MM/AAAA` (ex.: `08/2026`) — o
  mês que está sendo fechado, lido linha a linha (não um parâmetro do arquivo inteiro); a
  diretoria é derivada do centro de resultado informado (não é mais uma coluna própria — o
  centro de resultado precisa já ter uma diretoria vinculada em Estrutura Organizacional).
  Processa a planilha, atualiza `employees.current_salary`/`employees.cost_center_id` de
  cada colaborador (como sempre) e além disso grava um snapshot do mês de cada linha em
  `payroll_snapshots` — reimportar o mesmo (year, month) substitui o snapshot anterior de
  cada colaborador, nunca duplica. Quando este fechamento avança o mês mais recente da folha
  (não é uma correção de um mês antigo), qualquer colaborador que estava `ATIVO` e tinha
  snapshot no fechamento anterior mas não aparece nesta planilha é automaticamente marcado
  `INATIVO` (sinal de que saiu da empresa entre um mês e outro); reimportar um mês antigo
  nunca dispara isso, para não mexer no status de quem já foi substituído por um fechamento
  posterior mais recente. Retorna `ImportBatch` com
  `{ id, totalRows, successRows, errorRows, errors: [{rowNumber, field, message}], deactivated: [{id, registration, name}] }`
  (`deactivated` lista quem foi inativado automaticamente nesta importação — vazio na
  maioria das vezes)
- `GET /employees/import/:batchId`
- `GET /employees/comparison?year=&month=` → compara base x orçada, agregando por centro
  de resultado (nunca por cargo — sempre diretoria + centro de resultado) no mês de referência
  (`month` 1-12, padrão mês corrente). O lado "atual" usa **exclusivamente** o snapshot de
  fechamento daquele mês exato (ver `POST /employees/import` acima) — nunca o salário atual
  ao vivo. Sem fechamento para o mês pedido, `hcCurrent`/`budgetSavings`/`budgetOverrun`
  vêm zerados e `monthClosed: false`; usar o salário atual (que reflete o último mês
  fechado, não necessariamente o mês pedido) faria um mês sem fechamento "herdar" os
  números de outro mês, como se as folhas tivessem sido somadas entre meses. O orçamento
  não é vinculado a colaborador, então a comparação não casa por matrícula:
  ```json
  {
    "year": 2026, "month": 1,
    "hcBudgeted": 85, "hcCurrent": 80,
    "openPositions": 8, "headcountExcess": 3,
    "budgetSavings": 12000, "budgetOverrun": 4000,
    "movementsByType": { "SEM_MOVIMENTACAO": 73, "PROMOCAO": 2, "MERITO": 1, "SUBSTITUICAO": 1, "AUMENTO_DE_QUADRO": 4, "DESLIGAMENTO": 4 },
    "items": [{ "type": "VAGA_ABERTA", "directorate": "...", "costCenter": "...", "budgetedCount": 2, "currentCount": 1, "budgetedCost": 8400, "currentCost": 4200 }],
    "monthClosed": true
  }
  ```

## Budget (orçamento) — módulo 1
Orçamento por **diretoria + centro de resultado + cargo** — não é vinculado a
colaborador (sem matrícula/nome). Cada linha tem um `movementType`
(`SEM_MOVIMENTACAO | PROMOCAO | MERITO | SUBSTITUICAO | AUMENTO_DE_QUADRO |
DESLIGAMENTO`) e um custo orçado por mês (`jan`..`dez`, `null` fora do
período orçado). Múltiplas linhas podem repetir a mesma combinação
diretoria+centro de resultado+cargo+tipo — cada uma representa uma vaga/assento
orçado distinto (24 linhas idênticas = 24 vagas daquele tipo).

- `POST /budget/import?year=` (multipart `file`) → `ImportBatch`. O `year` é
  sobreposto pelo ano derivado do cabeçalho de mês, quando este é uma data
  real (ver planilha abaixo). Reimportar substitui integralmente o orçado
  do ano para as diretorias presentes no arquivo.
- `GET /budget/entries?year=&directorateId=&costCenterId=&positionId=&page=&limit=`
- `GET /budget/dashboard?year=&month=&directorateId=&costCenterId=` →
  `{ year, month, hcBudgeted, payrollBudgeted, annualBudgeted }` — `hcBudgeted`/
  `payrollBudgeted` são do mês de referência (`month` 1-12, padrão mês
  corrente); `annualBudgeted` é a soma de todas as 12 colunas de todas as
  linhas (visão do ano inteiro).
- `GET /budget/adjustment?year=` (ADMIN) → `BudgetAdjustment[]` — todas as
  linhas configuradas para o ano, cada uma `{ id, year, directorateId, costCenterId, percent, updatedAt }`
  (`directorateId`/`costCenterId` `null` = escopo "todos"; só `directorateId`
  = uma diretoria inteira; ambos = um centro de resultado específico dessa
  diretoria). `PUT /budget/adjustment` (ADMIN)
  `{ year, directorateId?, costCenterId?, percent }` — cria ou substitui
  (identificada por `year`+`directorateId`+`costCenterId`) uma linha do
  Ajuste de Orçamento: um percentual (ex.: 90) que reduz/aumenta
  proporcionalmente todo "orçado" em R$ exibido no sistema (Dashboard,
  Simulador, `EmployeesService#compareWithBudget`) sem alterar os valores
  originais em `budget_entries` — o fator é aplicado só na leitura, nunca
  gravado sobre a fonte. `DELETE /budget/adjustment/:id` (ADMIN) remove uma
  linha — o escopo dela volta a 100% (sem ajuste). Pode haver mais de uma
  linha por ano (uma "todos" + uma ou mais escopadas); quando mais de uma se
  aplica a uma mesma linha de orçamento (diretoria + centro de resultado), a
  **mais específica vence** — centro de resultado exato > diretoria inteira
  > "todos" (ver `resolveBudgetAdjustmentFactor` em
  `common/utils/months.util.ts`, usado por `BudgetService`,
  `DashboardService`, `EmployeesService` e `SimulatorService`). Nunca afeta
  contagem de HC/vagas orçadas, só valores monetários. Sem nenhuma linha
  aplicável, o fator é 100% (sem efeito). Só ADMIN tem acesso a estes
  endpoints (leitura e escrita) — os demais perfis nunca veem o percentual,
  apenas os valores já ajustados nos outros endpoints.

## Movements (solicitações) — módulo 3
Transferência foi descontinuada (não existe mais como `type`). Toda
movimentação tem um `costCenterId`: em `PROMOCAO`/`MERITO` é herdado do
colaborador; em `AUMENTO_QUADRO` é informado na solicitação (obrigatório,
já que não há colaborador para derivar).

- `GET /movements?status=&type=&directorateId=&costCenterId=&page=&limit=`
- `GET /movements/:id` (inclui `simulation` mais recente e `approvalSteps`)
- `POST /movements` body varia por `type`:
  - `PROMOCAO`: `{ type, employeeId, newPositionId, newSalary, effectiveDate, justification }`
  - `MERITO`: `{ type, employeeId, newSalary, effectiveDate, justification }` — igual à Promoção,
    informa-se o novo salário; o backend calcula e persiste `meritPercentage` automaticamente
    (`newSalary` precisa ser maior que o salário atual do colaborador)
  - `AUMENTO_QUADRO`: `{ type, positionId, quantity, plannedSalary, directorateId, costCenterId, effectiveDate, justification }`
- `PATCH /movements/:id` — RASCUNHO ou DEVOLVIDO (o próprio fluxo de rascunho, sem restrição de
  perfil) ou PENDENTE_APROVACAO (só ADMIN/RH_REMUNERACAO, para corrigir uma
  solicitação já em aprovação antes de decidida). Nunca muda `type`/`employeeId` —
  só os campos específicos do tipo, os mesmos aceitos em `POST /movements`. Editar
  uma PENDENTE_APROVACAO sempre reroda a simulação (mesmo efeito de
  `POST /movements/:id/simulate`) para a fila de aprovação nunca mostrar números
  defasados em relação ao que foi editado.
- `POST /movements/:id/submit` — aceita RASCUNHO (primeira submissão) ou DEVOLVIDO
  (reenvio após devolução, ver seção Aprovações abaixo; apaga as `approvalSteps` da
  rodada anterior antes de recriar) → dispara simulação + cria `approvalSteps` a partir do fluxo
  configurado + muda status para `PENDENTE_APROVACAO` + envia
  e-mail de notificação para ADMIN, RH_REMUNERACAO, o(s) GESTOR(es) do centro de resultado e o
  DIRETOR da diretoria (ver seção Notificações abaixo)
- `DELETE /movements/:id` (somente RASCUNHO, cancela)

## Simulador — módulo 4
- `POST /movements/:id/simulate` → recalcula e persiste `MovementSimulation`, retorna:
```json
{
  "monthlySalaryImpact": 0,
  "annualSalaryImpact": 0,
  "chargesTotal": 0,
  "benefitsTotal": 0,
  "totalMonthlyImpact": 0,
  "totalAnnualImpact": 0,
  "budgetedDirectoratePayroll": 0,
  "currentDirectoratePayroll": 0,
  "payrollAfterApproval": 0,
  "difference": 0,
  "percentConsumed": 0,
  "exceedsBudget": false,
  "alertMessage": "Movimentação aderente ao orçamento.",
  "salaryIncreasePercent": 0,
  "policyViolations": []
}
```
  Apesar do nome dos campos (herdado do modelo original), a comparação é
  sempre feita pelo **centro de resultado exato** (diretoria + centro de resultado)
  da movimentação — nunca pelo orçamento da diretoria inteira, e nunca
  restrita ao cargo específico da movimentação.

  `currentDirectoratePayroll` e `payrollAfterApproval` usam **exclusivamente**
  o fechamento da folha (`payroll_snapshots`) desse centro de resultado — nunca
  `employees.current_salary` ao vivo:
  - `currentDirectoratePayroll` = soma real (não anualizada) de todos os
    meses já fechados no ano da data efetiva da movimentação (ex.: soma de
    jan a ago se ago for o último fechamento).
  - `payrollAfterApproval` = `currentDirectoratePayroll` + uma projeção dos
    meses que faltam até dezembro: pega o total do **último mês fechado**
    para esse centro de resultado, soma o `totalMonthlyImpact` da movimentação
    (o novo "ritmo mensal" após a mudança) e multiplica pelos meses
    restantes no ano a partir da data efetiva (`monthsRemaining`) — não é
    `currentDirectoratePayroll + totalAnnualImpact` simples, que ignoraria
    o histórico real acumulado do centro de resultado.
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
  Quadro não gera violação, pois não reajusta um colaborador existente)
  foge da Política de Remuneração (tela ADMIN/RH_REMUNERACAO, ver seção
  abaixo): `salaryIncreasePercent` acima do limite configurado para o tipo
  (`maxMeritPercent`/`maxPromotionPercent`), ou menos meses do que
  `minMonthsBetweenRaises` desde o último Mérito/Promoção desse
  colaborador em `movement_history` (`employeeId` precisa estar presente
  na entrada — o Simulador Rápido e o fluxo de submissão sempre enviam).
  As mensagens ficam salvas em `movement_simulations.policy_violations`,
  visíveis tanto para quem simula/solicita quanto para quem vai aprovar.
- `POST /simulator/preview` — Simulador Rápido (Gestor/Diretor testam o
  impacto de uma promoção/mérito para um colaborador ANTES de abrir a
  solicitação de fato; não persiste nada). Body:
  `{ employeeId, type: 'PROMOCAO'|'MERITO', newPositionId?, newSalary?, effectiveDate }`
  (`newPositionId` só para `PROMOCAO`; `newSalary` é obrigatório para os dois — para `MERITO` o
  percentual de mérito é calculado a partir dele, mesma UX da Promoção).
  Retorna o mesmo formato de `POST /movements/:id/simulate` acima. 403 se o
  colaborador estiver fora do escopo de acesso do usuário.
- `GET /charge-parameters` / `POST` / `PATCH /:id` (ADMIN, RH_REMUNERACAO) — encargos/benefícios parametrizáveis
- `GET /remuneration-policy` (qualquer autenticado) → `{ maxMeritPercent, maxPromotionPercent, minMonthsBetweenRaises }`
  (cada campo `number | null` — `null` = sem limite configurado). `PUT
  /remuneration-policy` (ADMIN, RH_REMUNERACAO) mesmo body → Política de
  Remuneração (tela "Política de Remuneração"): limites globais opcionais
  usados por `policyViolations` acima. Uma única linha (singleton); nunca
  bloqueia simulação/submissão, só alimenta a sinalização.

## Notificações
Dois eventos disparam e-mail:
1. Ao submeter uma movimentação (`POST /movements/:id/submit`), o backend
   resolve os destinatários (ADMIN, RH_REMUNERACAO, o(s) GESTOR(es) cujo escopo
   inclui o `costCenterId` da movimentação, e o DIRETOR da diretoria) e monta um
   e-mail de resumo.
2. Ao decidir a última etapa (`POST /approvals/:stepId/approve` ou `/reject`),
   só quem solicitou recebe: aprovada (todas as etapas concluídas) ou devolvida
   para ajuste (`comment` da recusa como motivo).

Neste ambiente não há credenciais SMTP configuradas — o
envio real ainda não está implementado (o corpo/destinatários são resolvidos
e registrados via log, prontos para plugar um provedor real). A versão Apps
Script do sistema envia o e-mail de verdade via `MailApp`, usando a própria
conta Google do deploy, com um template HTML com a identidade visual Beep.

## Aprovações — módulo 5
O fluxo de aprovação é configurável (ADMIN, tela Fluxo de Aprovação): uma
sequência de etapas ordenadas, cada uma com um conjunto de perfis
elegíveis — **qualquer um deles decide a etapa** (o que agir primeiro), não
todos. `movement_requests.status` fica em `PENDENTE_APROVACAO` (genérico)
durante todo o fluxo; a etapa "ativa" é a de menor `order` ainda `PENDENTE`
em `approvalSteps`. GESTOR nunca aprova, só solicita.

- `GET /approval-workflow` → lista as etapas configuradas: `[{ id, stepOrder, roles }]`
- `PUT /approval-workflow` (ADMIN) `{ steps: [{ roles }] }` → substitui o fluxo inteiro (a
  ordem do array define `stepOrder`); não afeta movimentações já submetidas (cada
  `approvalStep` guarda um snapshot de `eligibleRoles` no momento da submissão)
- `GET /approvals/pending` (filtra pela etapa ativa cujo `eligibleRoles` inclui o perfil do
  usuário logado; DIRETOR só vê movimentações da própria diretoria)
- `POST /approvals/:stepId/approve` `{ comment? }` — se essa era a última etapa pendente, a
  movimentação vira `APROVADO`
- `POST /approvals/:stepId/reject` `{ comment }` (`comment` obrigatório, não-vazio — é o motivo que o
  solicitante vai ver) — pula as demais etapas e devolve a movimentação (`DEVOLVIDO`, não mais um
  `REPROVADO` definitivo) para quem solicitou; o solicitante pode editar (`PATCH /movements/:id`,
  mesma permissão de `RASCUNHO` — sem restrição de perfil) e reenviar (`POST /movements/:id/submit`,
  aceita `DEVOLVIDO` além de `RASCUNHO`), o que apaga as `approvalSteps` da rodada anterior e reinicia
  o fluxo do zero. `REPROVADO` continua existindo no enum só por compatibilidade com dados antigos —
  nenhum fluxo novo o produz.
- `GET /approvals/movement/:movementId` → linha do tempo completa, cada etapa com
  `{ id, order, eligibleRoles, decidedByRole, status, approverId, approverName, comment, decidedAt }`

## Histórico — módulo 6
- `GET /history?directorateId=&positionId=&type=&costCenterId=&startDate=&endDate=&page=&limit=`
- `GET /history/indicators?...mesmos filtros` →
  `{ promotionsCount, meritsCount, salaryGrowthPercent, accumulatedImpact, headcountEvolution: [{month, hc}] }`
- `GET /history/export?format=xlsx|pdf&...filtros` (download)

## Estudos Salariais — módulo 7
- `POST /salary-studies/import` (multipart `file`, body `{ name, source, referenceYear }`)
- `GET /salary-studies`
- `GET /salary-studies/:id/entries`
- `GET /salary-studies/positioning?directorateId=&positionId=` →
  lista colaboradores com `{ employee, currentSalary, marketP50, marketP90, classification }`
  onde `classification` ∈ `ABAIXO_DO_MERCADO | DENTRO_DO_MERCADO | ACIMA_DO_MERCADO`

## Dashboards executivos — módulo 8
Todos os endpoints abaixo (exceto `/movements`, que é sempre anual) aceitam
`months=` com um ou mais meses (`months=7` ou `months=7,8,9`; padrão: só o
mês corrente) — o Dashboard Executivo permite selecionar vários meses de
uma vez e ver o dashboard refletir exatamente o período escolhido, em vez
de só um mês por vez. **Custo (folha) é somado entre os meses selecionados**
(gasto acumulado do período); **headcount é a média** (não é aditivo — não
faz sentido "somar pessoas" entre meses). Selecionar os 12 meses dá a visão
"acumulado do ano".

- `GET /dashboard/headcount?year=&months=&directorateId=` →
  `{ year, months, hcBudgeted, hcCurrent, hcApproved, hcOpen, monthClosed, openMonths, byMonth: [{month, hcBudgeted, hcCurrent, hcOpen, monthClosed}] }`
  (`hcBudgeted`/`hcCurrent`/`hcOpen` são a média entre os meses selecionados; `hcApproved` é
  sempre anual)
- `GET /dashboard/payroll?year=&months=&directorateId=` →
  `{ year, months, payrollCurrent, payrollBudgeted, difference, monthClosed, openMonths, byMonth: [{month, payrollBudgeted, payrollCurrent, monthClosed}] }`
  (`payrollCurrent`/`payrollBudgeted` são a SOMA entre os meses selecionados — gasto
  acumulado do período)
  `hcCurrent`/`payrollCurrent` de cada mês usam **exclusivamente** o fechamento de folha
  daquele mês exato (`payroll_snapshots`) — nunca o salário atual ao vivo. Mês sem
  fechamento entra zerado (não "herda" os números de outro mês fechado) e aparece em
  `openMonths`; `monthClosed` só é `true` quando TODOS os meses selecionados estão fechados.
- `GET /dashboard/cost-centers?year=&months=&directorateId=` →
  `{ year, months, items: [{ directorateId, directorateName, costCenterId, costCenterName, budgetedCost, currentCost, difference, budgetedCount, currentCount, status }] }`
  Orçado x Atual por centro de resultado, somando o custo e mediando o headcount entre os meses
  selecionados — é o que permite a uma diretoria (filtro `directorateId`) ver exatamente quais
  dos seus centros de resultado estão `DENTRO` ou `ACIMA` do orçamento no período escolhido.
  `difference = currentCost - budgetedCost`; ordenado do maior estouro para a maior economia.
- `GET /dashboard/movements?year=&directorateId=` → `{ promotions, merits, headcountIncrease }`
- `GET /dashboard/financial?year=&months=&directorateId=` →
  `{ months, monthlyImpact, annualImpact, budgetConsumedPercent, annualPayrollProjection: [{month, value, closed, budgeted, overBudget}], directorateRanking: [{directorate, currentPayroll, annualBudget, consumedPercent}], monthClosed, openMonths }`
  (`monthClosed`/`openMonths` refletem os mesmos meses usados em `budgetConsumedPercent`,
  herdados de `GET /dashboard/payroll`)
  `annualPayrollProjection` é a folha do ano inteiro (`year`), jan-dez, um
  item por mês (`month` 1-12): para meses já fechados, `value` é o
  fechamento real da folha somado (`closed: true`); para meses ainda sem
  fechamento, `value` projeta a partir do **último mês fechado** somando o
  impacto mensal de toda movimentação já `APROVADO` cujo `effectiveDate`
  caia depois desse último fechamento — o impacto entra no mês de vigência
  e persiste nos meses seguintes (`closed: false`), a mesma lógica de
  lacuna usada em `payrollAfterApproval` do Simulador (ver seção abaixo).
  Sem nenhum fechamento no ano, os meses abertos partem de zero (nunca
  herda `employees.current_salary` ao vivo nem dados de outro ano).
  `budgeted` é a soma do orçado (`budget_entries`) daquele mês, já com o
  fator de **Ajuste de Orçamento** do ano aplicado (mesmo cálculo de
  `payrollBudgeted` em `GET /dashboard/payroll`); `overBudget` é
  `true` quando `value > budgeted` (`budgeted > 0`), tanto para meses
  fechados (estouro real) quanto projetados (estouro projetado) — usado
  para sinalizar a barra em vermelho no gráfico.
  `directorateRanking.currentPayroll` usa **exclusivamente** o fechamento da folha
  (`payroll_snapshots`) dos meses selecionados, somado — nunca `employees.current_salary` ao
  vivo (que reflete o salário mais recente de cada colaborador, não o de um mês fechado
  específico) e não é mais anualizado (× 12); mesma semântica de "Folha Atual" da seção de
  Folha de Pagamento, só que quebrada por diretoria. `directorateRanking` vem **vazio
  (`[]`)** para GESTOR (identificado por `scope.costCenterIds !== undefined`) — esse
  comparativo abrange todas as diretorias da empresa, então não faz parte do escopo de um
  gestor restrito a alguns centros de resultado.

## Regras de negócio aplicadas no backend
1. Promoção não pode ter `newSalary < currentSalary` (400 se violar).
2. Sinaliza (nunca bloqueia, ver `policyViolations` acima) quando o % de
   reajuste ou o intervalo desde o último reajuste do colaborador fogem da
   Política de Remuneração (tela ADMIN/RH_REMUNERACAO, `GET`/`PUT
   /remuneration-policy`).
3. Se `totalAnnualImpact` fizer a folha do centro de resultado (nunca do cargo
   específico) ultrapassar o orçamento desse mesmo centro de resultado,
   `exceedsBudget = true` e a movimentação pode ser submetida mesmo assim
   (decisão fica com o workflow), mas o alerta é exibido em todas as telas.
4. Impacto acumulado do ano = soma de `movement_history.annual_impact` da
   diretoria/ano.
5. Projeção 12 meses = soma de impactos mensais de movimentações aprovadas e
   pendentes com `effective_date` nos próximos 12 meses.
6. Ranking de diretorias = `current_directorate_payroll / annual_budget` desc.
