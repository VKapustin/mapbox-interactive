declare module 'SearchTypes' {
  type SearchBoxProps = {
    onSelect: (result: SearchResult) => void;
    // Called when the input is emptied, by the clear button or by deleting the text.
    onClear?: () => void;
  };

  type SearchResult = {
    id: string;
    name: string;
    description: string;
    center: [number, number];
    bbox?: [number, number, number, number];
  }

  type SearchFeature = {
    id: string;
    geometry: { coordinates: [number, number] };
    properties: {
      mapbox_id: string;
      name: string;
      place_formatted?: string;
      bbox?: [number, number, number, number];
    };
  };
}