import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
      // A repeated POST could start a second paid run: mutations never retry by themselves.
      mutations: { retry: false },
    },
  });
