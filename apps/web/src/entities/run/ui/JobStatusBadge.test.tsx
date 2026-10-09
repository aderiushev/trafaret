import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JobStatusBadge } from './JobStatusBadge';

describe('JobStatusBadge', () => {
  it('shows how long a running job has been going', () => {
    render(<JobStatusBadge status="running" elapsedMs={3_400} />);
    expect(screen.getByText('Running · 3 s')).toBeInTheDocument();
  });

  it('labels finished and failed jobs', () => {
    const { rerender } = render(<JobStatusBadge status="success" />);
    expect(screen.getByText('✓ Done')).toBeInTheDocument();
    rerender(<JobStatusBadge status="error" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
