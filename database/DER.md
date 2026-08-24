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
        string approver_role
        string status
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
  agregando por esse mesmo bucket (diretoria+centro de custo+cargo) num mês
  de referência, não por matrícula.
- **`movement_requests` é polimórfica por `type`**: os campos específicos de cada
  tipo (mérito, transferência, aumento de quadro) ficam nullable na mesma
  tabela para permitir consultas e workflow unificados; a validação de
  obrigatoriedade por tipo é feita na camada de aplicação (DTOs) e reforçada
  por um CHECK básico (promoção não pode reduzir salário).
- **`approval_steps`** materializa o workflow Diretor → RH Remuneração →
  Financeiro como linhas ordenadas por `step_order`, permitindo auditoria de
  quem aprovou, quando e com qual comentário, além de paralelizar consultas de
  "pendências por perfil".
- **`movement_simulations`** persiste o resultado do simulador no momento da
  submissão (não é recalculado silenciosamente depois), garantindo que a
  decisão de aprovação seja auditável com os números que o aprovador viu.
- **`audit_logs`** é genérica (entity/entity_id + before/after em JSONB) para
  cobrir qualquer tabela sem precisar de uma tabela de auditoria por entidade.
