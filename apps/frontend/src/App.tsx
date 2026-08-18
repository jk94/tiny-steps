import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { GuestOnlyRoute } from './auth/GuestOnlyRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { HouseholdList } from './pages/HouseholdList';
import { HouseholdCreate } from './pages/HouseholdCreate';
import { HouseholdDetail } from './pages/HouseholdDetail';
import { ChildCreate } from './pages/ChildCreate';
import { ChildHome } from './pages/ChildHome';
import { ChildSettings } from './pages/ChildSettings';
import { FeedingHome } from './pages/FeedingHome';
import { FeedingBackfillCreate } from './pages/FeedingBackfillCreate';
import { FeedingEventEdit } from './pages/FeedingEventEdit';
import { SleepHome } from './pages/SleepHome';
import { SleepBackfillCreate } from './pages/SleepBackfillCreate';
import { SleepEventEdit } from './pages/SleepEventEdit';
import { DiaperHome } from './pages/DiaperHome';
import { DiaperBackfillCreate } from './pages/DiaperBackfillCreate';
import { DiaperEventEdit } from './pages/DiaperEventEdit';
import { DailyTimeline } from './pages/DailyTimeline';
import { Export } from './pages/Export';
import { InviteAccept } from './pages/InviteAccept';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          {/* There's no global "currently selected household/child" concept
              (multi-household, multi-child by design), so the household list
              doubles as the landing screen instead of a global dashboard. */}
          <Route index element={<HouseholdList />} />
          {/* Global, not household-scoped — like the household list. */}
          <Route path="profile" element={<Profile />} />
          <Route path="households" element={<HouseholdList />} />
          <Route path="households/new" element={<HouseholdCreate />} />
          <Route path="households/:householdId" element={<HouseholdDetail />} />
          <Route path="households/:householdId/children/new" element={<ChildCreate />} />
          <Route path="households/:householdId/children/:childId" element={<ChildHome />} />
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
          <Route path="households/:householdId/children/:childId/sleep" element={<SleepHome />} />
          <Route
            path="households/:householdId/children/:childId/sleep/new"
            element={<SleepBackfillCreate />}
          />
          <Route
            path="households/:householdId/children/:childId/sleep/:eventId/edit"
            element={<SleepEventEdit />}
          />
          <Route path="households/:householdId/children/:childId/diaper" element={<DiaperHome />} />
          <Route
            path="households/:householdId/children/:childId/diaper/new"
            element={<DiaperBackfillCreate />}
          />
          <Route
            path="households/:householdId/children/:childId/diaper/:eventId/edit"
            element={<DiaperEventEdit />}
          />
          <Route
            path="households/:householdId/children/:childId/timeline"
            element={<DailyTimeline />}
          />
          <Route
            path="households/:householdId/children/:childId/settings"
            element={<ChildSettings />}
          />
          <Route
            path="households/:householdId/children/:childId/settings/export"
            element={<Export />}
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
