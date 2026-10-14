import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import EraserIcon from '@/components/icons/EraserIcon';
import { renderWithTheme } from '@tests/support/renderWithTheme';

describe('EraserIcon', () => {
  it('renders like a built-in MUI icon, with a test id and a 24px box', () => {
    renderWithTheme(<EraserIcon />);

    const icon = screen.getByTestId('EraserIcon');
    expect(icon).toHaveClass('MuiSvgIcon-root');
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('takes the usual SvgIcon props', () => {
    renderWithTheme(<EraserIcon fontSize='small' color='primary' titleAccess='Eraser' />);

    const icon = screen.getByTestId('EraserIcon');
    expect(icon).toHaveClass('MuiSvgIcon-fontSizeSmall', 'MuiSvgIcon-colorPrimary');
    expect(screen.getByTitle('Eraser')).toBeInTheDocument();
  });

  it('draws an outline in the current text color', () => {
    renderWithTheme(<EraserIcon />);

    const group = screen.getByTestId('EraserIcon').querySelector('g')!;
    expect(group).toHaveAttribute('fill', 'none');
    expect(group).toHaveAttribute('stroke', 'currentColor');
  });
});
