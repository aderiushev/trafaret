import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Run } from '@trafaret/core';
import { branchingGraph, job, runSnapshot } from '@trafaret/core/testing';
import { catalogQuery } from '@/entities/catalog';
import { presetsQuery } from '@/entities/preset';
import { runQueryKey, useRunSession } from '@/entities/run';
import { ApiError } from '@/shared/api';
import { RunTimeline } from './RunTimeline';

const unreachable = new ApiError(0, 'NETWORK', "Can't reach the server.");

/** The timeline once polling has given up, holding the last snapshot it got, if any. */
async function renderAfterLostContact(snapshot?: Run) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(catalogQuery.queryKey, []);
  queryClient.setQueryData(presetsQuery.queryKey, []);
  const queryKey = runQueryKey('run_test');
  if (snapshot) queryClient.setQueryData(queryKey, snapshot);
  await queryClient.prefetchQuery({ queryKey, queryFn: () => Promise.reject(unreachable), retry: false });
  useRunSession.setState({ activeRunId: 'run_test', submittedGraph: branchingGraph() });
  return render(
    <QueryClientProvider client={queryClient}>
      <RunTimeline />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useRunSession.setState({ activeRunId: null, submittedGraph: null });
});

describe('RunTimeline', () => {
  it('keeps the last snapshot when contact is lost, and says how to recover', async () => {
    const running = job('gen-b', { status: 'running', finishedAt: null });
    await renderAfterLostContact(
      runSnapshot([job('gen-a'), running], { status: 'running', finishedAt: null }),
    );
    expect(
      screen.getByText(
        "Lost contact with the server: Can't reach the server. Run the workflow again — finished nodes are reused.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('says how to recover when not even a first snapshot arrived', async () => {
    await renderAfterLostContact();
    expect(
      screen.getByText(
        "Couldn't load the last run: Can't reach the server. Run the workflow again — finished nodes are reused.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
