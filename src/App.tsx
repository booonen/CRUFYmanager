import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CalendarRoute } from './routes/Calendar';
import { ClubsRoute } from './routes/Clubs';
import { CompetitionsRoute } from './routes/Competitions';
import { DashboardRoute } from './routes/Dashboard';
import { HistoryRoute } from './routes/History';
import { NationalTeamRoute } from './routes/NationalTeam';
import { OtherMatchesRoute } from './routes/OtherMatches';
import { PlayersRoute } from './routes/Players';
import { SavesRoute } from './routes/Saves';
import { WorldRoute } from './routes/World';
import { useSavefileStore } from './stores/savefile';

export function App() {
  const status = useSavefileStore((s) => s.status);
  const hydrate = useSavefileStore((s) => s.hydrate);

  useEffect(() => {
    if (status === 'idle') {
      void hydrate();
    }
  }, [status, hydrate]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/calendar" element={<CalendarRoute />} />
        <Route path="/competitions" element={<CompetitionsRoute />} />
        <Route path="/clubs" element={<ClubsRoute />} />
        <Route path="/players" element={<PlayersRoute />} />
        <Route path="/national-team" element={<NationalTeamRoute />} />
        <Route path="/other-matches" element={<OtherMatchesRoute />} />
        <Route path="/history" element={<HistoryRoute />} />
        <Route path="/world" element={<WorldRoute />} />
        <Route path="/saves" element={<SavesRoute />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
