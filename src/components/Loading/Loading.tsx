'use client';

import { FC } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {LoadingContainer} from '@/components/Loading/styles/loading.styles';
import { useString } from '@/hooks/string';

type LoadingProps = {
  // Read out by screen readers instead of a bare "progress bar".
  label?: string;
};

const Loading: FC<LoadingProps> = ({ label }) => {
  const text = useString('general');

  return (
    <LoadingContainer>
      <CircularProgress aria-label={label ?? text.loading} />
    </LoadingContainer>
  )
}

export default Loading;
