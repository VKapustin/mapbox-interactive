// Stands in for next/font/google in tests: the real loaders only run inside
// the Next.js compiler. Every font gets a plain family name and CSS variable.
const font = ({ variable }: { variable?: string } = {}) => ({
  className: 'font',
  variable: variable ?? '',
  style: { fontFamily: "'Mulish'" },
});

export const Mulish = font;
