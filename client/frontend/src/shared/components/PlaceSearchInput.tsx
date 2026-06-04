import { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import './PlaceSearchInput.css';

export interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  onPlaceSelect: (result: PlaceResult) => void;
  placeholder?: string;
}

setOptions({ key: import.meta.env.VITE_GOOGLE_PLACES_KEY });

export function PlaceSearchInput({ onPlaceSelect, placeholder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || elementRef.current) return;

    importLibrary('places').then(({ PlaceAutocompleteElement }: google.maps.PlacesLibrary) => {
      if (!containerRef.current || elementRef.current) return;

      const element = new PlaceAutocompleteElement({ placeholder: placeholder ?? null });
      elementRef.current = element;
      containerRef.current.appendChild(element);

      element.addEventListener('gmp-select', async (event: google.maps.places.PlacePredictionSelectEvent) => {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

        onPlaceSelect({
          name: place.displayName ?? '',
          address: place.formattedAddress ?? '',
          lat: place.location?.lat() ?? 0,
          lng: place.location?.lng() ?? 0,
        });
      });
    });

    return () => {
      elementRef.current?.remove();
      elementRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="place-search-wrapper" />;
}
