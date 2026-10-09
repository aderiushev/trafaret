import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchPresets } from '../api/preset-api';

/** Presets live on the server and never change while it runs. */
export const presetsQuery = queryOptions({
  queryKey: ['presets'],
  queryFn: ({ signal }) => fetchPresets(signal),
  staleTime: Infinity,
  // The API may still be starting: three tries more (about 7 s) before giving up.
  retry: 3,
});

export const usePresets = () => useQuery(presetsQuery);
