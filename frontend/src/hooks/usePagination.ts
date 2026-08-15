import * as React from 'react';

/** Client-side pagination over an already-fetched array — resets to page 1 whenever the array identity/length changes (e.g. filters change). */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = React.useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [items.length, totalPages, page]);

  const pageItems = React.useMemo(() => {
    const from = (page - 1) * pageSize;
    return items.slice(from, from + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, totalPages, pageItems, total: items.length };
}
