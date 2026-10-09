import type { Issue } from '@trafaret/core';
import { pluralize } from '@/shared/lib';

/**
 * The toast for a run that can't start. One issue speaks for itself; several get a count, and the ones that
 * belong to no node (such as "add a Generate node") are listed, since no card can show them.
 */
export function describeIssues(issues: readonly Issue[]): { title: string; details: string[] } {
  const [only] = issues;
  if (issues.length === 1 && only) return { title: only.message, details: [] };
  return {
    title: `Fix ${pluralize(issues.length, 'issue')} to run.`,
    details: issues.filter((issue) => issue.nodeId === undefined).map((issue) => issue.message),
  };
}
