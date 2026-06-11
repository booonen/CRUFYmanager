import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CalendarRoute } from './routes/Calendar';
import { CalendarMatchdayRoute } from './routes/CalendarMatchday';
import { ClubDetailRoute } from './routes/ClubDetail';
import { ClubsRoute } from './routes/Clubs';
import { CompetitionDetailRoute } from './routes/CompetitionDetail';
import { CompetitionsRoute } from './routes/Competitions';
import { DashboardRoute } from './routes/Dashboard';
import { HistoryRoute } from './routes/History';
import { IssuesRoute } from './routes/Issues';
import { ManagersRoute } from './routes/Managers';
import { NationalTeamRoute } from './routes/NationalTeam';
import { OtherMatchesRoute } from './routes/OtherMatches';
import { PlayerDetailRoute } from './routes/PlayerDetail';
import { PlayersRoute } from './routes/Players';
import { SavesRoute } from './routes/Saves';
import { SimLabRoute } from './routes/SimLab';
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
        <Route path="/issues" element={<IssuesRoute />} />
        <Route path="/calendar" element={<CalendarRoute />} />
        <Route path="/calendar/:md" element={<CalendarMatchdayRoute />} />
        <Route path="/competitions" element={<CompetitionsRoute />} />
        <Route path="/competitions/:id" element={<CompetitionDetailRoute />} />
        <Route path="/clubs" element={<ClubsRoute />} />
        <Route path="/clubs/:id" element={<ClubDetailRoute />} />
        <Route path="/players" element={<PlayersRoute />} />
        <Route path="/players/:id" element={<PlayerDetailRoute />} />
        <Route path="/managers" element={<ManagersRoute />} />
        <Route path="/national-team" element={<NationalTeamRoute />} />
        <Route path="/other-matches" element={<OtherMatchesRoute />} />
        <Route path="/history" element={<HistoryRoute />} />
        <Route path="/world" element={<WorldRoute />} />
        <Route path="/sim-lab" element={<SimLabRoute />} />
        <Route path="/saves" element={<SavesRoute />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
