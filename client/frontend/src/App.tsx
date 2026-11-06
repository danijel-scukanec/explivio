import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TripsPage } from './features/trips/pages/TripsPage';
import { TripLayout } from './features/trips/pages/TripLayout';
import { ItineraryPage } from './features/itinerary/pages/ItineraryPage';
import { BudgetPage } from './features/budget/pages/BudgetPage';
import { RecapPage } from './features/recap/pages/RecapPage';
import { AiUsagePage } from './features/ai-usage/pages/AiUsagePage';
import { BookingsPage } from './features/reservations/pages/BookingsPage';
import { ChecklistsPage } from './features/checklists/pages/ChecklistsPage';
import { DocumentsPage } from './features/documents/pages/DocumentsPage';
import { GalleryPage } from './features/gallery/pages/GalleryPage';
import { PublicTripPage } from './features/gallery/pages/PublicTripPage';
import { UserProfilePage } from './features/gallery/pages/UserProfilePage';
import { AppHeader } from './shared/components/AppHeader';
import { AppFooter } from './shared/components/AppFooter';
import { ConfirmProvider } from './shared/components/ConfirmProvider';

function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/trips" element={<TripsPage />} />
        {/* Shared "master" layout: the trip header + tabs persist while the sub-page content swaps. */}
        <Route path="/trips/:tripId" element={<TripLayout />}>
          <Route index element={<Navigate to="itinerary" replace />} />
          <Route path="itinerary" element={<ItineraryPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="checklists" element={<ChecklistsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="recap" element={<RecapPage />} />
        </Route>
        <Route path="/ai-usage" element={<AiUsagePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/gallery/:tripId" element={<PublicTripPage mode="gallery" />} />
        <Route path="/users/:userId" element={<UserProfilePage />} />
            <Route path="/shared/:token" element={<PublicTripPage mode="shared" />} />
          </Routes>
        </main>
        <AppFooter />
      </div>
      </ConfirmProvider>
    </BrowserRouter>
  );
}

export default App;
