import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchCatalog } from '../api/catalog-api';

/** The server's models never change while it runs. */
export const catalogQuery = queryOptions({
  queryKey: ['catalog'],
  queryFn: ({ signal }) => fetchCatalog(signal),
  staleTime: Infinity,
});

export const useCatalog = () => useQuery(catalogQuery);
