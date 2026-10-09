import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('is a plain button unless told otherwise, so it never submits a form by accident', () => {
    render(<Button>Run</Button>);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('type', 'button');
  });

  it('ignores clicks while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
