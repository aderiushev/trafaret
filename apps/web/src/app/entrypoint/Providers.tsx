import { QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { useState, type ReactNode } from 'react';
import { ErrorBoundary, Toaster } from '@/shared/ui';
import { createQueryClient } from './query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ReactFlowProvider>{children}</ReactFlowProvider>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
