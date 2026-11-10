'use client';

import { type ComponentProps, FC } from 'react';
import { type IconButton } from '@mui/material';
import { SoftDisabledIconButtonRoot } from '@/components/SoftDisabledIconButton/styles/softDisabledIconButton.styles';

type SoftDisabledIconButtonProps = ComponentProps<typeof IconButton> & {
  // Can't be used right now, e.g. "zoom to" a layer with nothing in the drawn area.
  softDisabled?: boolean;
};

// An icon button that can be soft-disabled: disabled, but still focusable and
// hoverable (the term Material Design uses for this). A plain disabled button
// gets no pointer events and can't be focused, so its tooltip (often the only
// explanation of why) never shows, and keyboard and screen-reader users skip
// it. Soft-disabled, it looks disabled and ignores clicks and keys, and
// aria-disabled tells assistive tech. Use it inside a Tooltip with
// `describeChild`, so the tooltip describes it.
const SoftDisabledIconButton: FC<SoftDisabledIconButtonProps> = ({ softDisabled = false, onClick, ...props }) => (
  <SoftDisabledIconButtonRoot
    {...props}
    softDisabled={softDisabled}
    aria-disabled={softDisabled || undefined}
    disableRipple={softDisabled || props.disableRipple}
    onClick={softDisabled ? undefined : onClick}
  />
);

export default SoftDisabledIconButton;
