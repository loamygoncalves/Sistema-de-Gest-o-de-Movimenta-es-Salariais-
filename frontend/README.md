# SGMS — Frontend

Frontend do **Sistema de Gestão de Movimentações Salariais**, construído com
Next.js 14 (App Router), React, TypeScript, Tailwind CSS e `recharts`.

## Como rodar

```bash
cd frontend
cp .env.local.example .env.local   # ajuste NEXT_PUBLIC_API_URL se necessário
npm install
npm run dev
```

A aplicação sobe em `http://localhost:3000` e consome a API REST do backend
NestJS (padrão: `http://localhost:3001/api`, configurável via
`NEXT_PUBLIC_API_URL` em `.env.local`).

## Scripts

- `npm run dev` — ambiente de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — sobe o build de produção
- `npm run lint` — lint (eslint-config-next)

## Estrutura

- `src/lib/api.ts` — wrapper de fetch tipado (base URL, Bearer token,
  tratamento de 401 com redirecionamento para `/login`, upload multipart e
  download de arquivos).
- `src/lib/auth.tsx` — `AuthProvider`/`useAuth()` (contexto de autenticação
  persistido em `localStorage`, com `hasRole(...roles)`).
- `src/lib/toast.tsx` — sistema de notificações (toasts) próprio, sem
  dependência externa.
- `src/types/*.ts` — interfaces TypeScript espelhando os DTOs/respostas do
  `docs/API_CONTRACT.md`.
- `src/components/ui/*` — componentes de UI reutilizáveis (Card, Table,
  Badge, Button, Modal, FileDropzone, KpiCard, Input/Select/Textarea,
  Pagination, StatusBadge, etc).
- `src/components/layout/*` — `Sidebar`, `Topbar`, `AuthGuard` (guarda de
  rota autenticada) e `RoleGuard` (guarda de rota por perfil).
- `src/components/shared/*` — componentes compartilhados entre páginas
  (`ImportResultCard`, `EmployeePicker`, filtros de ano/diretoria).
- `src/hooks/*` — hooks de dados (`useOrgOptions`, `useCrudResource`).
- `src/app/(auth)/login` — tela de login.
- `src/app/(app)/*` — todas as telas autenticadas (dashboard, orçamento,
  colaboradores, movimentações, aprovações, histórico, estudos salariais,
  administração), envolvidas pelo layout com sidebar + topbar.

## Autenticação

O token JWT retornado por `POST /auth/login` é armazenado em
`localStorage` (`sgms.token`) junto com os dados do usuário (`sgms.user`).
Toda chamada via `src/lib/api.ts` anexa `Authorization: Bearer <token>`
automaticamente; uma resposta `401` limpa a sessão e redireciona para
`/login`.

## Observações / decisões de implementação

O contrato de API (`docs/API_CONTRACT.md`) documenta os endpoints, mas não
detalha 100% dos campos de cada entidade nem alguns enums auxiliares. Onde
isso ocorreu, foi feita uma escolha de projeto razoável, sinalizada com
comentários `judgment call` no código-fonte (principalmente em
`src/types/*.ts`). Destaques:

- **Status de movimentação**: fluxo de aprovação configurável (ADMIN cadastra
  as etapas em Administração > Fluxo de Aprovação), então
  `movement_requests.status` fica em `PENDENTE_APROVACAO` genérico durante
  todo o fluxo (além de `RASCUNHO`, `APROVADO`, `REPROVADO`, `CANCELADO`) —
  qual etapa está ativa é derivado de `ApprovalStep` (a de menor `order`
  ainda `PENDENTE`), não do status da movimentação.
- **Papel dos approval steps**: cada etapa tem um conjunto de perfis
  elegíveis (`eligibleRoles: ApprovalStepRole[]`, valores
  `ADMIN | DIRETOR | RH_REMUNERACAO`) — qualquer um deles decide, o que agir
  primeiro; `decidedByRole` registra qual perfil de fato decidiu.
- **Paginação**: assumido o envelope `{ data, total, page, limit }` para os
  endpoints paginados (`Paginated<T>` em `src/types/common.ts`).
  Endpoints de catálogo simples (`/directorates`, `/positions`,
  `/cost-centers`, `/managements`) são tratados de forma defensiva,
  aceitando tanto um array simples quanto `{ data: [...] }`.
- **Campos de entidades** não detalhados no contrato (Employee, Directorate,
  Management, Coordination, Position, CostCenter, User, MovementRequest,
  ApprovalStep, MovementHistoryEntry, SalaryStudy/Entry, ChargeParameter)
  foram modelados com os campos típicos de um sistema de RH/folha
  (nome, status, datas, valores). Os nomes dos campos citados
  explicitamente no contrato (ex.: os corpos de `POST /movements`, a
  resposta do simulador, os KPIs dos dashboards) foram seguidos
  literalmente.
- **Categoria dos parâmetros de encargo/benefício** (`ENCARGO`/
  `BENEFICIO`) e o tipo (`PERCENTUAL`/`FIXO`) são uma inferência a partir da
  descrição textual do módulo 4 ("encargos/benefícios parametrizáveis" e
  "percentual/fixo").
- **Breakdown de encargos/benefícios** no simulador: a resposta oficial do
  contrato só traz os totais agregados (`chargesTotal`, `benefitsTotal`).
  A tela do simulador (`movements/[id]`) já sabe renderizar uma lista de
  itens (`chargesBreakdown`/`benefitsBreakdown`) caso o backend venha a
  incluir esses campos opcionais na resposta; na ausência deles, apenas os
  totais são exibidos.
