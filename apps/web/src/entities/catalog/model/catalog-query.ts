import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchCatalog } from '../api/catalog-api';

/** The server's models never change while it runs. */
export const catalogQuery = queryOptions({
  queryKey: ['catalog'],
  queryFn: ({ signal }) => fetchCatalog(signal),
  staleTime: Infinity,
  // The API may still be starting: three tries more (about 7 s) before the editor says it can't reach it.
  retry: 3,
});

export const useCatalog = () => useQuery(catalogQuery);
