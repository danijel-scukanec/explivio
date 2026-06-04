import { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: PlaceResult) => void;
  placeholder?: string;
}

setOptions({
  key: import.meta.env.VITE_GOOGLE_PLACES_KEY,
});

export function PlaceSearchInput({ value, onChange, onPlaceSelect, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    let listener: google.maps.MapsEventListener;

    importLibrary('places').then(({ Autocomplete }: google.maps.PlacesLibrary) => {
      const autocomplete = new Autocomplete(inputRef.current!, {
        types: ['establishment', 'geocode'],
        fields: ['name', 'formatted_address', 'geometry'],
      });

      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;
        onPlaceSelect({
          name: place.name ?? '',
          address: place.formatted_address ?? '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      });
    });

    return () => { listener?.remove(); };
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
