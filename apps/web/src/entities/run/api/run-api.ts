import { runIdResponseSchema, runSchema, type CreateRunBody, type Graph, type Run } from '@trafaret/core';
import { http, request } from '@/shared/api';

export async function createRun(graph: Graph): Promise<string> {
  const body: CreateRunBody = { graph };
  const { runId } = await request(http.post('runs', { json: body }).json(runIdResponseSchema));
  return runId;
}

export const fetchRun = (runId: string, signal?: AbortSignal): Promise<Run> =>
  request(http.get(`runs/${encodeURIComponent(runId)}`, { signal }).json(runSchema));

/** No request body: the node to retry is in the path. */
export async function retryNode(runId: string, nodeId: string): Promise<void> {
  const path = `runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/retry`;
  await request(http.post(path).json(runIdResponseSchema));
}
