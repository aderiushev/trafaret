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

/** The timeline showing `snapshot`. After lost contact, polling has given up and the snapshot is the last it got. */
async function renderTimeline(snapshot?: Run, { lostContact = false } = {}) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(catalogQuery.queryKey, []);
  queryClient.setQueryData(presetsQuery.queryKey, []);
  const queryKey = runQueryKey('run_test');
  if (snapshot) queryClient.setQueryData(queryKey, snapshot);
  if (lostContact) {
    await queryClient.prefetchQuery({ queryKey, queryFn: () => Promise.reject(unreachable), retry: false });
  }
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
    await renderTimeline(runSnapshot([job('gen-a'), running], { status: 'running', finishedAt: null }), {
      lostContact: true,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Lost contact with the server: Can't reach the server. Run the workflow again — finished nodes are reused.",
    );
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('says how to recover when not even a first snapshot arrived', async () => {
    await renderTimeline(undefined, { lostContact: true });
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load the last run: Can't reach the server. Run the workflow again — finished nodes are reused.",
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('names a failed call in words, not only in red', async () => {
    const declined = {
      code: 'INVALID_INPUT' as const,
      message: 'The model declined this prompt.',
      retryable: false,
    };
    await renderTimeline(
      runSnapshot([job('gen-a', { status: 'error', error: declined }), job('gen-b')], { status: 'failed' }),
    );
    const [failed, done] = screen.getAllByRole('listitem');
    expect(failed).toHaveTextContent('Failed');
    expect(done).toHaveTextContent('1.0 s');
  });
});
