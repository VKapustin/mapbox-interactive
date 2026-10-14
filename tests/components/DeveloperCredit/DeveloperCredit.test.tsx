import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import DeveloperCredit from '@/components/DeveloperCredit/DeveloperCredit';
import { renderWithTheme } from '@tests/support/renderWithTheme';

describe('DeveloperCredit', () => {
  it('credits the developer, linking their name to GitHub in a new tab', () => {
    const { container } = renderWithTheme(<DeveloperCredit />);

    // A real space between the words and the name, not just CSS spacing.
    expect(container.textContent).toBe('Developed by Viacheslav Kapustin');
    const link = screen.getByRole('link', { name: 'Viacheslav Kapustin' });
    expect(link).toHaveAttribute('href', 'https://github.com/VKapustin/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps the GitHub icon out of the link\'s name', () => {
    renderWithTheme(<DeveloperCredit />);

    expect(screen.getByRole('link').querySelector('[data-testid="GitHubIcon"]')).toHaveAttribute('aria-hidden', 'true');
  });
});
