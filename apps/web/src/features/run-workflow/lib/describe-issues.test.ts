import { describe, expect, it } from 'vitest';
import { describeIssues } from './describe-issues';

describe('describeIssues', () => {
  it('lets a single issue speak for itself', () => {
    const issues = [{ code: 'MISSING_VALUE' as const, message: 'Write a prompt.', nodeId: 'p1' }];
    expect(describeIssues(issues)).toEqual({ title: 'Write a prompt.', details: [] });
  });

  it('counts several issues and lists the ones no node can show', () => {
    const issues = [
      { code: 'MISSING_INPUT' as const, message: 'The Image input needs a connection.', nodeId: 'r1' },
      {
        code: 'NOTHING_TO_RUN' as const,
        message: 'Add a Generate Image or Edit Image node to run the workflow.',
      },
    ];
    expect(describeIssues(issues)).toEqual({
      title: 'Fix 2 issues to run.',
      details: ['Add a Generate Image or Edit Image node to run the workflow.'],
    });
  });
});
