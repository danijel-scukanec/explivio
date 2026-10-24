import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TripsPage } from './features/trips/pages/TripsPage';
import { ItineraryPage } from './features/itinerary/pages/ItineraryPage';
import { BudgetPage } from './features/budget/pages/BudgetPage';
import { BookingsPage } from './features/reservations/pages/BookingsPage';
import { ChecklistsPage } from './features/checklists/pages/ChecklistsPage';
import { DocumentsPage } from './features/documents/pages/DocumentsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
        <Route path="/trips/:tripId/budget" element={<BudgetPage />} />
        <Route path="/trips/:tripId/bookings" element={<BookingsPage />} />
        <Route path="/trips/:tripId/checklists" element={<ChecklistsPage />} />
        <Route path="/trips/:tripId/documents" element={<DocumentsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
