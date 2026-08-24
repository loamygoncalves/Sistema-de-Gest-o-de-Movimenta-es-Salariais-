// Shared response shapes. The contract documents list endpoints with
// `page`/`limit` query params but does not spell out the exact pagination
// envelope — `Paginated<T>` below is a judgment call using the most common
// Nest/TypeORM convention (`data` + `total` + `page` + `limit`).
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface ImportBatchError {
  row: number;
  field: string;
  message: string;
}

export interface ImportBatch {
  id: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: ImportBatchError[];
  createdAt?: string;
}
