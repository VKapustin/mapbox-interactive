import {styled} from '@mui/material/styles';
import Box from '@mui/material/Box';

// Bottom left, after the Mapbox logo (8px from the edge, 88px wide), styled
// like the attribution text in the opposite corner. On narrow screens the
// attribution line takes most of the bottom edge, so the credit sits just
// above the logo instead (the logo is 23px tall).
export const DeveloperCreditWrapper = styled(Box)(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    left: '104px',
    bottom: '8px',
    zIndex: 1,
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    lineHeight: '19px',
    whiteSpace: 'nowrap',
    color: palette.text.primary,
    backgroundColor: theme.alpha(palette.background.paper, 0.75),
    [theme.breakpoints.down('sm')]: {
      left: '8px',
      bottom: '35px',
    },
  };
});

export const CreditText = styled(Box)({
  marginRight: '2px',
});

export const CreditLink = styled('a')(({ theme }) => {
  const { palette } = theme.vars ?? theme;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    color: palette.primary.main,
    fontWeight: 600,
    textDecoration: 'none',
    '&:hover, &:focus-visible': {
      textDecoration: 'underline',
    },
  };
});
