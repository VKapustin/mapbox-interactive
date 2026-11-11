import { createSvgIcon } from '@mui/material/utils';

// The "eraser" icon from Lucide (https://lucide.dev/icons/eraser, lucide-static
// v1.71.0), as a MUI icon: built with createSvgIcon, so it takes the same props
// (fontSize, color, sx, …) and gets data-testid="EraserIcon" like the built-in
// icons.
//
// The drawing fills almost the whole 24px box, while Material icons leave about
// 2px of space around the glyph, so it's drawn at 90% around the center to look
// the same size as the icons next to it.
//
// Lucide's icons are under the ISC License, whose notice must be kept with them:
//
//   ISC License
//
//   Copyright (c) 2026 Lucide Icons and Contributors
//
//   Permission to use, copy, modify, and/or distribute this software for any
//   purpose with or without fee is hereby granted, provided that the above
//   copyright notice and this permission notice appear in all copies.
//
//   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
//   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
//   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
//   ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
//   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
//   ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
//   OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
const EraserIcon = createSvgIcon(
  <g
    transform='translate(12 12) scale(0.9) translate(-12 -12)'
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21' />
    <path d='m5.082 11.09 8.828 8.828' />
  </g>,
  'Eraser',
);

export default EraserIcon;
