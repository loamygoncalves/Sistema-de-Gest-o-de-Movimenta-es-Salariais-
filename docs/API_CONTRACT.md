# Contrato de API — Backend NestJS

Base URL: `http://localhost:3001/api`. Todas as rotas (exceto `/auth/login`)
exigem header `Authorization: Bearer <jwt>`. Respostas de erro seguem o formato
padrão do Nest: `{ statusCode, message, error }`.

Perfis (`role`): `ADMIN`, `RH_REMUNERACAO`, `DIRETOR`, `FINANCEIRO`, `GESTOR`.
Usuários `DIRETOR` e `GESTOR` têm `directorateId` e só enxergam dados dessa
diretoria (o backend filtra automaticamente pelo escopo do token).

## Auth
- `POST /auth/login` `{ email, password }` → `{ accessToken, user: { id, name, email, role, directorateId } }`
- `GET /auth/me` → usuário autenticado

## Organização (ADMIN, RH_REMUNERACAO: escrita; demais: leitura)
- `GET/POST /directorates`, `GET/PATCH/DELETE /directorates/:id`
- `GET/POST /managements`, `GET/PATCH/DELETE /managements/:id` (`?directorateId=`)
- `GET/POST /coordinations` (`?managementId=`)
- `GET/POST /positions`, `GET/PATCH/DELETE /positions/:id`
- `GET/POST /cost-centers`
- `GET/POST /users` (ADMIN only), `PATCH /users/:id`, `PATCH /users/:id/password`

## Employees (base atual) — módulo 2
- `GET /employees?directorateId=&positionId=&status=&search=&page=&limit=`
- `GET /employees/:id`
- `POST /employees` / `PATCH /employees/:id` / `DELETE /employees/:id`
- `POST /employees/import` (multipart `file`) → processa Excel, retorna `ImportBatch`
  com `{ id, totalRows, successRows, errorRows, errors: [{row, field, message}] }`
- `GET /employees/import/:batchId`
- `GET /employees/comparison?year=` → compara base atual x orçada:
  `{ promotionsDone, promotionsPending, openPositions, headcountExcess, budgetSavings, budgetOverrun, items: [...] }`

## Budget (orçamento) — módulo 1
- `POST /budget/import?year=` (multipart `file`) → `ImportBatch`
- `GET /budget/entries?year=&directorateId=&page=&limit=`
- `GET /budget/dashboard?year=&directorateId=` →
  `{ hcBudgeted, hcCurrent, hcDifference, payrollBudgeted, payrollCurrent, financialDeviation, budgetConsumedPercent }`

## Movements (solicitações) — módulo 3
- `GET /movements?status=&type=&directorateId=&page=&limit=`
- `GET /movements/:id` (inclui `simulation` mais recente e `approvalSteps`)
- `POST /movements` body varia por `type`:
  - `PROMOCAO`: `{ type, employeeId, newPositionId, newSalary, effectiveDate, justification }`
  - `MERITO`: `{ type, employeeId, percentage, effectiveDate, justification }` (valor calculado no backend)
  - `AUMENTO_QUADRO`: `{ type, positionId, quantity, plannedSalary, directorateId, effectiveDate, justification }`
  - `TRANSFERENCIA`: `{ type, employeeId, originDirectorateId, destinationDirectorateId, newPositionId?, newSalary?, effectiveDate, justification }`
- `PATCH /movements/:id` (somente RASCUNHO)
- `POST /movements/:id/submit` → dispara simulação + cria `approvalSteps` + muda status para `PENDENTE_DIRETOR`
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
  "budget": { "budgeted": 0, "current": 0, "afterApproval": 0, "difference": 0, "percentConsumed": 0 },
  "exceedsBudget": false,
  "alertMessage": "Movimentação aderente ao orçamento."
}
```
- `GET /charge-parameters` / `POST` / `PATCH /:id` (ADMIN, RH_REMUNERACAO) — encargos/benefícios parametrizáveis

## Aprovações — módulo 5
- `GET /approvals/pending` (filtra pela role do usuário logado: DIRETOR só vê steps `DIRETOR` da própria diretoria etc.)
- `POST /approvals/:stepId/approve` `{ comment? }`
- `POST /approvals/:stepId/reject` `{ comment }`
- `GET /approvals/movement/:movementId` → linha do tempo completa

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
- `GET /dashboard/headcount?year=&directorateId=` → `{ hcBudgeted, hcCurrent, hcApproved, hcOpen }`
- `GET /dashboard/payroll?year=&directorateId=` → `{ payrollCurrent, payrollBudgeted, difference }`
- `GET /dashboard/movements?year=&directorateId=` → `{ promotions, merits, headcountIncrease, transfers }`
- `GET /dashboard/financial?year=&directorateId=` → `{ monthlyImpact, annualImpact, budgetConsumedPercent, projection12Months: [{month, impact}], directorateRanking: [{directorate, consumedPercent}] }`

## Regras de negócio aplicadas no backend
1. Promoção não pode ter `newSalary < currentSalary` (400 se violar).
2. Alerta quando o aumento percentual ultrapassar o parâmetro configurável
   `MAX_INCREASE_PERCENT_ALERT` (não bloqueia, apenas sinaliza `alertMessage`).
3. Se `totalAnnualImpact` fizer a folha da diretoria ultrapassar `annual_budget`,
   `exceedsBudget = true` e a movimentação pode ser submetida mesmo assim
   (decisão fica com o workflow), mas o alerta é exibido em todas as telas.
4. Impacto acumulado do ano = soma de `movement_history.annual_impact` da
   diretoria/ano.
5. Projeção 12 meses = soma de impactos mensais de movimentações aprovadas e
   pendentes com `effective_date` nos próximos 12 meses.
6. Ranking de diretorias = `current_directorate_payroll / annual_budget` desc.
