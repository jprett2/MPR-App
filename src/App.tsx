import { go, useRoute } from './router';
import { useApp } from './store/useApp';
import { SeasonScreen } from './screens/SeasonScreen';
import { GamesScreen } from './screens/GamesScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import { LiveScreen } from './screens/LiveScreen';
import { StatusScreen } from './screens/StatusScreen';
import { LogScreen } from './screens/LogScreen';
import { ExportScreen } from './screens/ExportScreen';
import { useWakeLock } from './useWakeLock';

const NAV: { name: string; path: string; label: string }[] = [
  { name: 'live', path: 'live', label: 'Live' },
  { name: 'status', path: 'status', label: 'Status' },
  { name: 'log', path: 'log', label: 'Log' },
  { name: 'export', path: 'export', label: 'Export' },
  { name: 'games', path: 'games', label: 'Games' },
  { name: 'season', path: 'season', label: 'Roster' },
];

export default function App() {
  const route = useRoute();
  const hydrated = useApp((s) => s.hydrated);
  const season = useApp((s) => s.seasons.find((x) => x.id === s.currentSeasonId));
  const game = useApp((s) => s.games.find((g) => g.id === s.currentGameId));
  useWakeLock(game?.status === 'live');

  if (!hydrated) return <div className="screen">Loading…</div>;

  let body: React.ReactNode;
  if (!season) body = <SeasonScreen />;
  else if (route.name === 'season') body = <SeasonScreen />;
  else if (route.name === 'games') body = <GamesScreen />;
  else if (route.name === 'setup') body = <GameSetupScreen gameId={route.gameId} />;
  else if (!game) body = <GamesScreen />;
  else if (route.name === 'status') body = <StatusScreen game={game} />;
  else if (route.name === 'log') body = <LogScreen game={game} />;
  else if (route.name === 'export') body = <ExportScreen game={game} />;
  else if (game.status === 'setup') body = <GameSetupScreen gameId={game.id} />;
  else body = <LiveScreen game={game} />;

  return (
    <div className="app">
      <div className="topbar">
        <h1>MPR</h1>
        <div className="nav">
          {NAV.map((n) => (
            <button key={n.name} className={route.name === n.name ? 'active' : ''} onClick={() => go(n.path)}>
              {n.label}
            </button>
          ))}
        </div>
      </div>
      {body}
    </div>
  );
}
