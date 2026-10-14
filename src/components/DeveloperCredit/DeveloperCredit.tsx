'use client';

import { FC } from 'react';
import GitHubIcon from '@mui/icons-material/GitHub';
import { CreditLink, CreditText, DeveloperCreditWrapper } from '@/components/DeveloperCredit/styles/developerCredit.styles';
import { DEVELOPER } from '@/constant/constant';
import { useString } from '@/hooks/string';

// "Developed by <name>" in the bottom-left corner, after the Mapbox logo, with
// the name linking to the developer's GitHub profile. Kept out of the map's
// attribution line, which credits the map data (and is required by Mapbox).
const DeveloperCredit: FC = () => {
  const text = useString('developerCredit');

  return (
    <DeveloperCreditWrapper>
      <CreditText>
        {text.developedBy}
      </CreditText>
      {/* For copied text and screen readers; the flex row draws no gap for it. */}
      {' '}
      <CreditLink href={DEVELOPER.url} target='_blank' rel='noopener noreferrer'>
        {/* Decorative: the name says where the link goes. */}
        <GitHubIcon aria-hidden fontSize='inherit' />
        {DEVELOPER.name}
      </CreditLink>
    </DeveloperCreditWrapper>
  );
}

export default DeveloperCredit;
