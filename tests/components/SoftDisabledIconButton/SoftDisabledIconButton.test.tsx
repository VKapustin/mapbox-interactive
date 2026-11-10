import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SoftDisabledIconButton from '@/components/SoftDisabledIconButton/SoftDisabledIconButton';
import { renderWithTheme } from '@tests/support/renderWithTheme';

describe('SoftDisabledIconButton', () => {
  it('works like an IconButton when available', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithTheme(<SoftDisabledIconButton aria-label='Zoom' onClick={onClick}>Z</SoftDisabledIconButton>);

    await user.click(screen.getByRole('button', { name: 'Zoom' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Zoom' })).not.toHaveAttribute('aria-disabled');
  });

  it('ignores clicks and keys while soft-disabled, but stays focusable and hoverable', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithTheme(<SoftDisabledIconButton aria-label='Zoom' softDisabled onClick={onClick}>Z</SoftDisabledIconButton>);
    const button = screen.getByRole('button', { name: 'Zoom' });

    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}{ }');

    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    // Unlike a disabled button, it still gets pointer events (for its tooltip).
    expect(getComputedStyle(button).pointerEvents).not.toBe('none');
  });
});
