// Organization structure entities. Field lists beyond `id`/`name` and the
// FK filters named in the contract (`directorateId`, `managementId`) are a
// judgment call built for a typical HR org-chart + budget model.

export interface Directorate {
  id: string;
  name: string;
  code?: string;
  annualBudget?: number;
  createdAt?: string;
}

export interface Management {
  id: string;
  name: string;
  directorateId: string;
  directorateName?: string;
}

export interface Coordination {
  id: string;
  name: string;
  managementId: string;
  managementName?: string;
}

export interface Position {
  id: string;
  name: string;
  level?: string;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  /** Oculta o salário dos colaboradores desse cargo para o perfil GESTOR (ex.: Gerente/Diretor). */
  hideSalaryFromManager?: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  directorateId?: string;
}
