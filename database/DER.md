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

    EMPLOYEES ||--o{ BUDGET_ENTRIES : vincula
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
        string registration
        uuid position_id FK
        uuid directorate_id FK
        string planned_situation
        numeric planned_salary
        int planned_month
        numeric monthly_budgeted_cost
        numeric annual_budgeted_cost
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

- **Snapshot vs. referência viva**: `budget_entries` e `movement_history` guardam
  campos "achatados" (nome, cargo, diretoria no momento do fato) além das FKs,
  para que relatórios históricos não mudem retroativamente se um cargo for
  renomeado ou um colaborador transferido depois.
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
