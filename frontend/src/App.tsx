import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TripsPage } from './features/trips/pages/TripsPage';
import { ItineraryPage } from './features/itinerary/pages/ItineraryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
