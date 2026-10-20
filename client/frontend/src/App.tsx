import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TripsPage } from './features/trips/pages/TripsPage';
import { ItineraryPage } from './features/itinerary/pages/ItineraryPage';
import { BudgetPage } from './features/budget/pages/BudgetPage';
import { BookingsPage } from './features/reservations/pages/BookingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
        <Route path="/trips/:tripId/budget" element={<BudgetPage />} />
        <Route path="/trips/:tripId/bookings" element={<BookingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
