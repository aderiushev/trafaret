import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NodeShell } from './NodeShell';

describe('NodeShell', () => {
  it('frames a card with its category, title and status', () => {
    render(
      <NodeShell
        title="Generate Image"
        category="generation"
        status="running"
        selected={false}
        handles={null}
      >
        body
      </NodeShell>,
    );
    const card = screen.getByRole('article', { name: 'Generate Image' });
    expect(card).toHaveAttribute('data-status', 'running');
    expect(card).toHaveAttribute('data-selected', 'false');
    expect(card).toHaveTextContent('Generation');
    expect(card).toHaveTextContent('body');
  });

  it('shows the edited marker and the issues found on the node', () => {
    const issues = [{ code: 'MISSING_VALUE' as const, message: 'Write a prompt.', nodeId: 'p1' }];
    render(
      <NodeShell
        title="Prompt"
        category="input"
        status="idle"
        selected
        edited
        issues={issues}
        handles={null}
      />,
    );
    expect(screen.getByText('● edited')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Write a prompt.');
    expect(screen.getByRole('article', { name: 'Prompt' })).toHaveAttribute('data-selected', 'true');
  });
});
