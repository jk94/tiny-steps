import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { GuestOnlyRoute } from './auth/GuestOnlyRoute';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { HouseholdList } from './pages/HouseholdList';
import { HouseholdCreate } from './pages/HouseholdCreate';
import { HouseholdDetail } from './pages/HouseholdDetail';
import { ChildCreate } from './pages/ChildCreate';
import { ChildEdit } from './pages/ChildEdit';
import { FeedingHome } from './pages/FeedingHome';
import { FeedingBackfillCreate } from './pages/FeedingBackfillCreate';
import { FeedingEventEdit } from './pages/FeedingEventEdit';
import { InviteAccept } from './pages/InviteAccept';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="households" element={<HouseholdList />} />
          <Route path="households/new" element={<HouseholdCreate />} />
          <Route path="households/:householdId" element={<HouseholdDetail />} />
          <Route path="households/:householdId/children/new" element={<ChildCreate />} />
          <Route path="households/:householdId/children/:childId" element={<ChildEdit />} />
          <Route
            path="households/:householdId/children/:childId/feeding"
            element={<FeedingHome />}
          />
          <Route
            path="households/:householdId/children/:childId/feeding/new"
            element={<FeedingBackfillCreate />}
          />
          <Route
            path="households/:householdId/children/:childId/feeding/:eventId/edit"
            element={<FeedingEventEdit />}
          />
        </Route>
        <Route element={<GuestOnlyRoute />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>
        {/* Neither ProtectedRoute nor GuestOnlyRoute: works logged-in or not */}
        <Route path="invites/:token" element={<InviteAccept />} />
      </Route>
    </Routes>
  );
}

export default App;
