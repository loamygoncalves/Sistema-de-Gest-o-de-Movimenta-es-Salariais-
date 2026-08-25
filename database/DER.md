# Modelo Entidade-Relacionamento (DER)

Diagrama de referência do banco definido em `schema.sql` / `backend/src/migrations`.

```mermaid
erDiagram
    DIRECTORATES ||--o{ MANAGEMENTS : possui
    MANAGEMENTS ||--o{ COORDINATIONS : possui
    DIRECTORATES ||--o{ COST_CENTERS : possui
    DIRECTORATES ||--o{ USERS : escopo
    DIRECTORATES ||--o{ EMPLOYEES : lota
    DIRECTORATES ||--o{ BUDGET_ENTRIES : orca
    DIRECTORATES ||--o{ MOVEMENT_REQUESTS : origina
    COST_CENTERS ||--o{ MOVEMENT_REQUESTS : referencia

    USERS ||--o{ USER_COST_CENTERS : escopo
    COST_CENTERS ||--o{ USER_COST_CENTERS : escopo

    POSITIONS ||--o{ EMPLOYEES : ocupa
    POSITIONS ||--o{ BUDGET_ENTRIES : referencia
    POSITIONS ||--o{ SALARY_STUDY_ENTRIES : referencia

    USERS ||--o{ MOVEMENT_REQUESTS : solicita
    USERS ||--o{ APPROVAL_STEPS : aprova
    USERS ||--o{ IMPORT_BATCHES : importa
    USERS ||--o{ SALARY_STUDIES : importa
    USERS ||--o{ AUDIT_LOGS : gera

    COST_CENTERS ||--o{ BUDGET_ENTRIES : referencia
    EMPLOYEES ||--o{ MOVEMENT_REQUESTS : sofre
    EMPLOYEES ||--o{ MOVEMENT_HISTORY : sofre

    IMPORT_BATCHES ||--o{ IMPORT_ERRORS : gera
    IMPORT_BATCHES ||--o{ BUDGET_ENTRIES : origina
    IMPORT_BATCHES ||--o{ EMPLOYEES : atualiza
    EMPLOYEES ||--o{ PAYROLL_SNAPSHOTS : fecha
    DIRECTORATES ||--o{ PAYROLL_SNAPSHOTS : lota
    COST_CENTERS ||--o{ PAYROLL_SNAPSHOTS : lota

    MOVEMENT_REQUESTS ||--o{ APPROVAL_STEPS : possui
    MOVEMENT_REQUESTS ||--o{ MOVEMENT_SIMULATIONS : possui
    MOVEMENT_REQUESTS ||--o| MOVEMENT_HISTORY : gera

    SALARY_STUDIES ||--o{ SALARY_STUDY_ENTRIES : possui

    DIRECTORATES {
        uuid id PK
        string name
        numeric annual_budget
    }
    EMPLOYEES {
        uuid id PK
        string registration
        string name
        uuid position_id FK
        uuid directorate_id FK
        numeric current_salary
        string status
    }
    PAYROLL_SNAPSHOTS {
        uuid id PK
        int year
        int month
        uuid employee_id FK
        uuid directorate_id FK
        uuid cost_center_id FK
        numeric salary
    }
    BUDGET_ENTRIES {
        uuid id PK
        int year
        uuid directorate_id FK
        uuid cost_center_id FK
        uuid position_id FK
        string movement_type
        numeric jan
        numeric fev
        numeric mar
        numeric dez
    }
    MOVEMENT_REQUESTS {
        uuid id PK
        string type
        string status
        uuid employee_id FK
        uuid directorate_id FK
        uuid cost_center_id FK
        numeric current_salary
        numeric new_salary
        date effective_date
    }
    MOVEMENT_SIMULATIONS {
        uuid id PK
        uuid movement_request_id FK
        numeric total_monthly_impact
        numeric total_annual_impact
        numeric percent_consumed
        bool exceeds_budget
    }
    APPROVAL_STEPS {
        uuid id PK
        uuid movement_request_id FK
        int step_order
        string[] eligible_roles
        string decided_by_role
        string status
    }
    APPROVAL_WORKFLOW_STEPS {
        uuid id PK
        int step_order
        string[] roles
    }
    MOVEMENT_HISTORY {
        uuid id PK
        uuid movement_request_id FK
        uuid employee_id FK
        string type
        numeric monthly_impact
        numeric annual_impact
    }
    SALARY_STUDIES {
        uuid id PK
        string name
        int reference_year
    }
    SALARY_STUDY_ENTRIES {
        uuid id PK
        uuid study_id FK
        uuid position_id FK
        numeric p50
        numeric p90
    }
    USERS {
        uuid id PK
        string name
        string email
        string role
        uuid directorate_id FK
    }
    USER_COST_CENTERS {
        uuid user_id PK,FK
        uuid cost_center_id PK,FK
    }
```

## Notas de modelagem

- **Snapshot vs. referência viva**: `movement_history` guarda campos
  "achatados" (cargo, diretoria no momento do fato) além das FKs, para que
  relatórios históricos não mudem retroativamente se um cargo for renomeado
  depois.
- **`budget_entries` não é vinculada a colaborador**: o orçamento é por
  (diretoria, centro de custo, cargo, tipo de movimentação), com o custo
  orçado em 12 colunas mensais (`jan`..`dez`, nulas fora do período orçado).
  Não há matrícula/nome nem chave única — múltiplas linhas repetindo a mesma
  combinação diretoria+centro de custo+cargo+tipo representam vagas/assentos
  distintos daquele tipo (ex.: 24 linhas idênticas de "Analista I / Sem
  Movimentação" no mesmo centro de custo = 24 vagas orçadas para esse cargo).
  A comparação com a base atual de colaboradores (módulo 2) é feita
  agregando por diretoria+centro de custo (nunca por cargo) num mês de
  referência, não por matrícula — comparar por cargo faria um cargo
  estourado e outro com sobra no mesmo centro de custo aparecerem como dois
  problemas separados em vez de se cancelarem.
- **`payroll_snapshots`** é o fechamento mensal da folha (`POST
  /employees/import`, coluna `mes_de_referencia` da planilha, formato
  `MM/AAAA`): um "retrato" do salário de cada
  colaborador no mês em que a base foi fechada. `employees.current_salary` é
  um valor único e vivo — sem esse snapshot, um relatório de um mês passado
  mostraria o salário mais recente (re-importado depois) em vez do que a
  folha realmente era naquele mês. Onde existir snapshot para (year, month),
  `DashboardService`/`EmployeesService#compareWithBudget` usam o valor
  congelado; sem snapshot para o mês pedido (mês corrente ainda em aberto,
  ou histórico anterior a este recurso), caem para `current_salary` ao vivo.
  Reimportar o mesmo (year, month) substitui o snapshot anterior de cada
  colaborador (chave única `year+month+employee_id`), nunca duplica.
- **`movement_requests` é polimórfica por `type`**: os campos específicos de
  cada tipo (mérito, aumento de quadro) ficam nullable na mesma tabela para
  permitir consultas e workflow unificados; a validação de obrigatoriedade
  por tipo é feita na camada de aplicação (DTOs) e reforçada por um CHECK
  básico (promoção não pode reduzir salário). Toda linha tem um
  `cost_center_id`: herdado do colaborador em promoção/mérito, informado na
  solicitação em aumento de quadro (obrigatório, já que não há colaborador
  para derivar).
- **`user_cost_centers`**: escopo de um usuário `GESTOR` — uma seleção de
  centros de custo (em vez de uma diretoria inteira, como o `DIRETOR`, que
  usa `users.directorate_id`). Ausência de linhas = o Gestor não vê nada
  (nunca "vê tudo" por omissão).
- **`approval_workflow_steps`** é a configuração do fluxo de aprovação
  (tela Administração > Fluxo de Aprovação, só ADMIN): uma sequência de
  etapas ordenadas por `step_order`, cada uma com um conjunto de perfis
  (`roles`) — qualquer um deles decide a etapa, o que agir primeiro. Sem FK
  para nenhuma outra tabela; a tabela inteira é substituída a cada
  salvamento. `roles` é `TEXT[]` (não um enum Postgres) de propósito: a
  lista de perfis válidos é definida em `ApproverRole` (TypeScript) e pode
  mudar sem nova migration.
- **`approval_steps`** materializa, por movimentação, uma etapa por linha de
  `approval_workflow_steps` no momento da submissão (`eligible_roles` é um
  snapshot — mudar o fluxo depois não afeta solicitações já em andamento).
  Qual etapa está "ativa" é derivado dinamicamente (a de menor `step_order`
  ainda `PENDENTE`), não armazenado no status da movimentação.
  `decided_by_role` registra qual perfil, dentre os elegíveis, de fato
  decidiu — para auditoria — junto com quem aprovou/reprovou, quando e com
  qual comentário.
- **`movement_simulations`** persiste o resultado do simulador no momento da
  submissão (não é recalculado silenciosamente depois), garantindo que a
  decisão de aprovação seja auditável com os números que o aprovador viu.
- **`audit_logs`** é genérica (entity/entity_id + before/after em JSONB) para
  cobrir qualquer tabela sem precisar de uma tabela de auditoria por entidade.
