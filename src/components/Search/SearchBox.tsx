'use client';

import React, { FC, useEffect, useState } from 'react';
import { Autocomplete, CircularProgress, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import {
  OptionDescription,
  OptionName,
  OptionText,
  SearchBoxWrapper,
  SearchPaper,
  SearchTextField,
} from '@/components/Search/styles/searchBox.styles';
import {SEARCH_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH} from '@/constant/constant';
import {getMapCenterLonLat, search} from '@/helpers/mapHelpers';
import {useMap} from '@/hooks/map';
import {type SearchResult, type SearchBoxProps} from 'SearchTypes';
import { useString } from '@/hooks/string';

const SearchBox: FC<SearchBoxProps> = ({ onSelect, onClear }) => {
  const text = useString('search');
  const { map } = useMap();
  const [query, setQuery] = useState('');
  const [value, setValue] = useState<SearchResult | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const queryTrimmed = query.trim();
    
    // Selecting an option fills the input with its name; don't search for it again.
    if (queryTrimmed.length < SEARCH_MIN_QUERY_LENGTH || queryTrimmed === value?.name) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      search(queryTrimmed, getMapCenterLonLat(map), controller.signal)
        .then((r) => {
          setResults(r);
          setError(false);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setResults([]);
          setError(true);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value, map]);

  const changeQuery = (newQuery: string, reason: string): void => {
    setQuery(newQuery);
    
    // 'clear' is the × button; other reasons are MUI syncing the input to the value.
    if (reason !== 'input' && reason !== 'clear') { 
      return 
    }
    
    if (newQuery === '') {
      onClear?.();
    }
    
    setValue(null);
    
    const searchable = newQuery.trim().length >= SEARCH_MIN_QUERY_LENGTH;
    setLoading(searchable);
    
    if (!searchable) {
      setResults([]);
      setError(false);
    }
  }

  const select = (result: SearchResult | null): void => {
    setValue(result);
    
    if (result) { 
      onSelect(result) 
    }
  }

  return (
    <SearchBoxWrapper>
      <Autocomplete
        options={results}
        value={value}
        inputValue={query}
        open={open && query.trim().length >= SEARCH_MIN_QUERY_LENGTH}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        onChange={(_, result) => select(result)}
        onInputChange={(_, newQuery, reason) => changeQuery(newQuery, reason)}
        // Results are already ranked by Mapbox; don't filter them again locally.
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        loading={loading}
        loadingText={text.searching}
        noOptionsText={error ? text.unavailable : text.noResults}
        autoHighlight
        clearOnBlur={false}
        forcePopupIcon={false}
        slots={{ paper: SearchPaper }}
        renderOption={({ key, ...props }, option) => (
          <li key={`${String(key)}${props.id}`} {...props}>
            <OptionText>
              <OptionName>{option.name}</OptionName>
              {option.description && <OptionDescription>{option.description}</OptionDescription>}
            </OptionText>
          </li>
        )}
        renderInput={(params) => (
          <SearchTextField
            {...params}
            size='small'
            placeholder={text.placeholder}
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps.htmlInput, 'aria-label': text.label },
              input: {
                ...params.slotProps.input,
                startAdornment: (
                  <InputAdornment position='start'>
                    <SearchIcon fontSize='small' />
                  </InputAdornment>
                ),
                endAdornment: (
                  <>
                    {loading && <CircularProgress size={16} sx={{ color: 'inherit' }} />}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
    </SearchBoxWrapper>
  );
}

export default SearchBox;
