import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import Loading from '@/components/Loading/Loading';
import { renderWithTheme } from '@tests/support/renderWithTheme';

describe('Loading', () => {
  it('renders a progress indicator with a default label', () => {
    renderWithTheme(<Loading />);

    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
  });

  it('uses the given label as the accessible name', () => {
    renderWithTheme(<Loading label='Loading map' />);

    expect(screen.getByRole('progressbar', { name: 'Loading map' })).toBeInTheDocument();
  });
});
