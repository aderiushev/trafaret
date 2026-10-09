import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchPresets } from '../api/preset-api';

/** Presets live on the server and never change while it runs. */
export const presetsQuery = queryOptions({
  queryKey: ['presets'],
  queryFn: ({ signal }) => fetchPresets(signal),
  staleTime: Infinity,
});

export const usePresets = () => useQuery(presetsQuery);
