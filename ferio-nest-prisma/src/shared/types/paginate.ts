/**
 * Paginate Options Interface
 * Used for pagination queries
 */
export interface PaginateOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  populate?: any;
  select?: string;
}

/**
 * Paginate Result Interface
 * Returned from paginated queries
 */
export interface PaginateResult<T> {
  docs: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
