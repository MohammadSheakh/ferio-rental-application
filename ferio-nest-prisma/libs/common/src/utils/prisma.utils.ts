export function cleanFilters(filters: Record<string, any>): Record<string, any> {
  const controlKeys = new Set(['page', 'limit', 'sortBy', 'include', 'populate', 'select', 'cursor']);
  return Object.fromEntries(
    Object.entries(filters).filter((entry) => {
      const [key, value] = entry;
      return !controlKeys.has(key) && value !== undefined && value !== '';
    }),
  );
}

export function parseSort(sortBy?: string, defaultKey: string = 'createdAt'): Record<string, 'asc' | 'desc'> {
  if (!sortBy) {
    return { [defaultKey]: 'desc' };
  }

  if (sortBy.startsWith('-')) {
    return { [sortBy.slice(1)]: 'desc' };
  }

  return { [sortBy]: 'asc' };
}

export function buildProjection(
  include?: Record<string, any>,
  select?: Record<string, boolean>,
): Record<string, any> {
  if (include) {
    return { include };
  }

  if (select) {
    return { select };
  }

  return {};
}
