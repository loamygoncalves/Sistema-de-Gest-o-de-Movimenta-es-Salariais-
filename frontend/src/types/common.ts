// Shared response shapes. Matches the backend's paginate() helper
// (backend/src/common/dto/pagination-query.dto.ts): `items` + `total` +
// `page` + `limit` + `totalPages`.
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface ImportBatchError {
  rowNumber: number;
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
