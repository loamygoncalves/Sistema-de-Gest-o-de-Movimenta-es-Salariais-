# Sistema de Gestão de Movimentações Salariais, Estudos Salariais e Controle Orçamentário

Plataforma corporativa para controle de orçamento anual de pessoal, headcount
(HC) orçado x realizado, movimentações salariais (promoção, mérito, aumento
de quadro), simulação de impacto financeiro (com um Simulador Rápido para
pré-visualizar o impacto antes de abrir a solicitação), workflow de aprovação
(Diretor → RH Remuneração → Financeiro) com notificação por e-mail, histórico
de movimentações e estudos salariais de mercado.

## Arquitetura

```
├── backend/      API REST em NestJS + TypeORM + PostgreSQL
├── frontend/     Next.js 14 (App Router) + React + TypeScript + Tailwind
├── apps-script/  Reimplementação alternativa rodando em Google Apps Script
│                 (Google Sheets como banco + Web App HtmlService) — ver
│                 apps-script/README.md
├── database/     schema.sql (DDL de referência) e DER.md (diagrama)
├── docs/         Contratos de API (REST e Apps Script)
└── docker-compose.yml
```

> Existem **duas implementações independentes** deste sistema neste
> repositório: a principal (`backend/` + `frontend/`, NestJS + PostgreSQL +
> Next.js) e uma versão simplificada em `apps-script/` para quem quer rodar
> dentro do Google Workspace sem hospedar servidor/banco próprios (Google
> Sheets como banco de dados). Elas não compartilham dados — escolha uma.

- **Backend**: Node.js + NestJS, PostgreSQL via TypeORM, autenticação
  JWT com RBAC (4 perfis: ADMIN, RH_REMUNERACAO, DIRETOR, GESTOR),
  fluxo de aprovação configurável (etapas com perfis elegíveis
  cadastradas pelo ADMIN), importação de planilhas Excel (exceljs),
  exportação Excel/PDF, documentação OpenAPI em `/docs` (Swagger).
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS,
  gráficos com Recharts, autenticação client-side com guarda de rotas
  por perfil.
- **Banco de dados**: PostgreSQL. O schema completo (enums, tabelas,
  índices, constraints) está em `database/schema.sql` e é aplicado em
  runtime pela migration `backend/src/migrations/1700000000000-InitialSchema.ts`.
  O DER está em `database/DER.md` (diagrama Mermaid).

## Módulos implementados

1. **Cadastro Orçamentário** — importação de planilha de orçamento anual
   com validação de matrícula duplicada, cargo/diretoria inexistentes e
   salários inválidos; dashboard de HC/folha orçado x atual.
2. **Base Atual de Colaboradores** — importação mensal da base ativa;
   comparação automática base atual x orçada (promoções realizadas/pendentes,
   vagas abertas, excesso de HC, economia/estouro de orçamento).
3. **Solicitação de Movimentação** — promoção, mérito e aumento de quadro,
   com regras de negócio (ex.: promoção não pode reduzir salário) e um
   Simulador Rápido para pré-visualizar o impacto antes de abrir a
   solicitação de fato.
4. **Simulador de Impacto** — impacto mensal/anual, encargos e benefícios
   parametrizáveis, comparação orçamentária (orçado/atual/após
   aprovação/diferença/% consumido) e alertas automáticos.
5. **Workflow de Aprovação** — Diretor → RH Remuneração → Financeiro, com
   registro de usuário, data/hora, comentário e status de cada etapa.
6. **Histórico de Movimentações** — filtros por diretoria, cargo, tipo,
   período e centro de custo; indicadores e exportação Excel/PDF.
7. **Estudos Salariais** — importação de pesquisas de mercado e
   posicionamento automático do salário atual x mercado (abaixo/dentro/acima,
   por faixa de percentil P25–P75).
8. **Dashboards Executivos** — HC, folha, movimentações e financeiro
   (projeção de 12 meses e ranking de diretorias por consumo de orçamento).

Perfis de acesso são aplicados via guards (`JwtAuthGuard` + `RolesGuard`) em
todos os endpoints — DIRETOR enxerga a própria diretoria inteira, GESTOR
enxerga apenas os centros de custo aos quais foi atribuído (multi-seleção,
configurada no cadastro do usuário); ver `docs/API_CONTRACT.md` para o
contrato completo.

## Como rodar

### Com Docker (recomendado)

```bash
docker compose up --build
```

- Backend: http://localhost:3001/api (Swagger em http://localhost:3001/docs)
- Frontend: http://localhost:3000

Depois de subir o Postgres, rode a migration e o seed dentro do container
do backend (ou localmente apontando para o Postgres do compose):

```bash
docker compose exec backend npm run migration:run
docker compose exec backend npm run seed
```

### Localmente (sem Docker)

Backend:

```bash
cd backend
cp .env.example .env   # ajuste as credenciais do Postgres se necessário
npm install
npm run migration:run
npm run seed            # cria diretorias, cargos, encargos e usuários de exemplo
npm run start:dev
```

Frontend:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### Usuários de exemplo (após `npm run seed`)

Senha padrão: `Senha@123`

| E-mail                          | Perfil          |
| -------------------------------- | --------------- |
| admin@empresa.com                | ADMIN            |
| rh@empresa.com                   | RH_REMUNERACAO   |
| diretor.comercial@empresa.com    | DIRETOR          |
| gestor.comercial@empresa.com     | GESTOR           |

## Planilhas de importação

Colunas esperadas (case-insensitive, acentos e espaços são normalizados):

- **Orçamento** (`POST /budget/import?year=`): `DIRETORIA, CENTRO DE CUSTO,
  CARGO, TIPO DE MOVIMENTAÇÃO` seguidas de 12 colunas de meses (jan a dez,
  idealmente como datas no cabeçalho — o ano é lido daí quando possível).
  Cada linha é uma vaga/assento orçado daquela diretoria+centro de
  custo+cargo — **não há matrícula/nome**; múltiplas linhas idênticas
  representam vagas distintas do mesmo tipo. `TIPO DE MOVIMENTAÇÃO` aceita:
  `Sem Movimentação, Promoção, Mérito, Substituição, Aumento de Quadro,
  Desligamento`. Nas colunas de mês, `-` (ou vazio) significa sem custo
  orçado naquele mês.
- **Base de colaboradores** (`POST /employees/import`): `matricula, nome,
  cargo, diretoria, salario_atual, data_admissao, status`.
- **Estudo salarial** (`POST /salary-studies/import`): `cargo, empresa,
  salario_minimo, salario_medio, salario_maximo, percentil_25,
  percentil_50, percentil_75, percentil_90`.

Cargos e diretorias devem existir previamente (cadastrados em
`/admin/organization` ou via API) — a importação rejeita linhas com
cargo/diretoria inexistentes, matrícula duplicada ou salário inválido, e
retorna um relatório linha a linha dos erros encontrados.

## Documentação adicional

- `docs/API_CONTRACT.md` — contrato completo da API REST.
- `database/DER.md` — modelo entidade-relacionamento.
- `database/schema.sql` — DDL de referência do banco.
- `backend/README.md` / `frontend/README.md` — detalhes específicos de cada app.
