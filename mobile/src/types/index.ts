export * from './auth';
export * from './file';
export * from './folder';
export * from './tag';
export * from './inbox';
export * from './tariff';
export * from './contact';
export * from './support';
export * from './shared-folder';

export interface ApiResponse<T = Record<string, unknown>> {
  result: 'success' | 'error';
  message: string;
  data: T;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}
