import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchSamples } from '../api/asset-api';

/** Sample photos are pinned on the server for as long as it runs. */
export const samplesQuery = queryOptions({
  queryKey: ['samples'],
  queryFn: ({ signal }) => fetchSamples(signal),
  staleTime: Infinity,
  // The API may still be starting: three tries more (about 7 s) before giving up.
  retry: 3,
});

export const useSamples = () => useQuery(samplesQuery);
