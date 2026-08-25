# Contrato de API — Backend NestJS

Base URL: `http://localhost:3001/api`. Todas as rotas (exceto `/auth/login`)
exigem header `Authorization: Bearer <jwt>`. Respostas de erro seguem o formato
padrão do Nest: `{ statusCode, message, error }`.

Perfis (`role`): `ADMIN`, `RH_REMUNERACAO`, `DIRETOR`, `GESTOR`.
`DIRETOR` tem `directorateId` e enxerga toda a diretoria; `GESTOR` tem
`costCenterIds` (multi-seleção) e enxerga só os colaboradores/orçamento
desses centros de custo (lista vazia = não vê nada — nunca "vê tudo" por
omissão). `ADMIN`/`RH_REMUNERACAO` não têm escopo restrito. GESTOR nunca
aprova movimentações — só solicita. O backend resolve esse escopo a partir do token
(`resolveAccessScope`/`applyAccessScope`) e aplica automaticamente em toda
consulta filtrável por diretoria/centro de custo — filtros de query string
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
  planilha com as colunas **CÓDIGO, CENTRO DE CUSTO e DIRETORIA** (diretoria é
  opcional; quando informada, é resolvida por nome exato). Rejeita código/nome
  vazio ou duplicado (na planilha ou já cadastrado) e diretoria informada mas
  inexistente. Retorna `ImportBatch` (mesmo formato abaixo).
- `GET /cost-centers/import/:batchId`
- `DELETE /cost-centers/:id` — exclusão definitiva (não há reativação; `code` é
  único). Centros de custo referenciados no orçamento não podem ser excluídos
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
- `POST /employees/import?year=&month=` (multipart `file`) — **fechamento mensal da folha**:
  `year`/`month` (obrigatórios) identificam o mês que está sendo fechado. Processa a
  planilha Excel, atualiza `employees.current_salary` de cada colaborador (como sempre) e
  além disso grava um snapshot desse mês em `payroll_snapshots` — reimportar o mesmo
  (year, month) substitui o snapshot anterior de cada colaborador, nunca duplica. Retorna
  `ImportBatch` com `{ id, totalRows, successRows, errorRows, errors: [{rowNumber, field, message}] }`
- `GET /employees/import/:batchId`
- `GET /employees/comparison?year=&month=` → compara base x orçada, agregando por centro
  de custo (nunca por cargo — sempre diretoria + centro de custo) no mês de referência
  (`month` 1-12, padrão mês corrente). O lado "atual" usa o snapshot de fechamento daquele
  mês quando existir (ver `POST /employees/import` acima); sem fechamento para esse mês,
  cai para `employees.current_salary` ao vivo. O orçamento não é vinculado a colaborador,
  então a comparação não casa por matrícula:
  ```json
  {
    "year": 2026, "month": 1,
    "hcBudgeted": 85, "hcCurrent": 80,
    "openPositions": 8, "headcountExcess": 3,
    "budgetSavings": 12000, "budgetOverrun": 4000,
    "movementsByType": { "SEM_MOVIMENTACAO": 73, "PROMOCAO": 2, "MERITO": 1, "SUBSTITUICAO": 1, "AUMENTO_DE_QUADRO": 4, "DESLIGAMENTO": 4 },
    "items": [{ "type": "VAGA_ABERTA", "directorate": "...", "costCenter": "...", "budgetedCount": 2, "currentCount": 1, "budgetedCost": 8400, "currentCost": 4200 }]
  }
  ```

## Budget (orçamento) — módulo 1
Orçamento por **diretoria + centro de custo + cargo** — não é vinculado a
colaborador (sem matrícula/nome). Cada linha tem um `movementType`
(`SEM_MOVIMENTACAO | PROMOCAO | MERITO | SUBSTITUICAO | AUMENTO_DE_QUADRO |
DESLIGAMENTO`) e um custo orçado por mês (`jan`..`dez`, `null` fora do
período orçado). Múltiplas linhas podem repetir a mesma combinação
diretoria+centro de custo+cargo+tipo — cada uma representa uma vaga/assento
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
- `PATCH /movements/:id` (somente RASCUNHO)
- `POST /movements/:id/submit` → dispara simulação + cria `approvalSteps` a partir do fluxo
  configurado (ver seção Aprovações abaixo) + muda status para `PENDENTE_APROVACAO` + envia
  e-mail de notificação para ADMIN, RH_REMUNERACAO, o(s) GESTOR(es) do centro de custo e o
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
  "alertMessage": "Movimentação aderente ao orçamento."
}
```
  Apesar do nome dos campos (herdado do modelo original), a comparação é
  sempre feita pelo **centro de custo exato** (diretoria + centro de custo)
  da movimentação — nunca pelo orçamento da diretoria inteira, e nunca
  restrita ao cargo específico da movimentação.
- `POST /simulator/preview` — Simulador Rápido (Gestor/Diretor testam o
  impacto de uma promoção/mérito para um colaborador ANTES de abrir a
  solicitação de fato; não persiste nada). Body:
  `{ employeeId, type: 'PROMOCAO'|'MERITO', newPositionId?, newSalary?, effectiveDate }`
  (`newPositionId` só para `PROMOCAO`; `newSalary` é obrigatório para os dois — para `MERITO` o
  percentual de mérito é calculado a partir dele, mesma UX da Promoção).
  Retorna o mesmo formato de `POST /movements/:id/simulate` acima. 403 se o
  colaborador estiver fora do escopo de acesso do usuário.
- `GET /charge-parameters` / `POST` / `PATCH /:id` (ADMIN, RH_REMUNERACAO) — encargos/benefícios parametrizáveis

## Notificações
Ao submeter uma movimentação (`POST /movements/:id/submit`), o backend
resolve os destinatários (ADMIN, RH_REMUNERACAO, o(s) GESTOR(es) cujo escopo
inclui o `costCenterId` da movimentação, e o DIRETOR da diretoria) e monta um
e-mail de resumo. Neste ambiente não há credenciais SMTP configuradas — o
envio real ainda não está implementado (o corpo/destinatários são resolvidos
e registrados via log, prontos para plugar um provedor real). A versão Apps
Script do sistema envia o e-mail de verdade via `MailApp`, usando a própria
conta Google do deploy.

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
- `POST /approvals/:stepId/reject` `{ comment }` — reprova a movimentação e pula as demais etapas
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
- `GET /dashboard/headcount?year=&month=&directorateId=` → `{ year, month, hcBudgeted, hcCurrent, hcApproved, hcOpen }`
  (`hcBudgeted` é o HC orçado no mês de referência; `month` 1-12, padrão mês corrente)
- `GET /dashboard/payroll?year=&month=&directorateId=` → `{ year, month, payrollCurrent, payrollBudgeted, difference }`
  (ambos valores mensais — `payrollBudgeted` soma as linhas de orçamento ativas naquele mês)
  `hcCurrent`/`payrollCurrent` usam o fechamento de folha daquele mês (`payroll_snapshots`)
  quando existir, senão caem para `employees.current_salary` ao vivo — ver `POST
  /employees/import` na seção Employees acima.
- `GET /dashboard/movements?year=&directorateId=` → `{ promotions, merits, headcountIncrease }`
- `GET /dashboard/financial?year=&month=&directorateId=` → `{ monthlyImpact, annualImpact, budgetConsumedPercent, projection12Months: [{month, impact}], directorateRanking: [{directorate, consumedPercent}] }`

## Regras de negócio aplicadas no backend
1. Promoção não pode ter `newSalary < currentSalary` (400 se violar).
2. Alerta quando o aumento percentual ultrapassar o parâmetro configurável
   `MAX_INCREASE_PERCENT_ALERT` (não bloqueia, apenas sinaliza `alertMessage`).
3. Se `totalAnnualImpact` fizer a folha do centro de custo (nunca do cargo
   específico) ultrapassar o orçamento desse mesmo centro de custo,
   `exceedsBudget = true` e a movimentação pode ser submetida mesmo assim
   (decisão fica com o workflow), mas o alerta é exibido em todas as telas.
4. Impacto acumulado do ano = soma de `movement_history.annual_impact` da
   diretoria/ano.
5. Projeção 12 meses = soma de impactos mensais de movimentações aprovadas e
   pendentes com `effective_date` nos próximos 12 meses.
6. Ranking de diretorias = `current_directorate_payroll / annual_budget` desc.
