import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
      // A repeated POST could start a second paid run: mutations never retry by themselves. Nor are they held
      // while offline, to go out on their own once the connection returns: they fail at once and say why.
      mutations: { retry: false, networkMode: 'always' },
    },
  });
