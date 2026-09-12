import { useState } from 'react';
import { playLogCsv, summaryCsv, summaryText } from '../export';
import { go } from '../router';
import { teamStatus } from '../store/derive';
import { dressedPlayers, gamePlays, rulesForSeason, useApp } from '../store/useApp';
import type { Game } from '../types';

async function shareOrCopy(title: string, text: string, filename?: string) {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  if (filename && nav.share) {
    const file = new File([text], filename, { type: 'text/csv' });
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title }); return 'shared'; } catch { /* cancelled */ }
    }
  }
  if (nav.share) {
    try { await nav.share({ title, text }); return 'shared'; } catch { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

export function ExportScreen({ game }: { game: Game }) {
  const s = useApp();
  const { finalizeGame, reopenGame } = useApp.getState();
  const [msg, setMsg] = useState('');
  const rules = rulesForSeason(s, game.seasonId);
  const plays = gamePlays(s, game.id);
  const teams = [s.teams.find((t) => t.id === game.homeTeamId)!, s.teams.find((t) => t.id === game.opponentTeamId)!].map((team) => ({
    team,
    status: teamStatus(rules, team.id, dressedPlayers(s, game.id, team.id), plays, game.currentPeriod),
  }));
  const text = summaryText(game, teams);
  const slug = `${game.date}-vs-${game.opponentName.replace(/\W+/g, '_')}`;

  const doShare = async (title: string, body: string, filename?: string) => {
    const r = await shareOrCopy(title, body, filename);
    setMsg(r === 'copied' ? 'Copied to clipboard.' : r === 'shared' ? 'Shared.' : 'Could not share.');
  };

  return (
    <div className="screen">
      <div className="card row">
        {game.status === 'final' ? (
          <><span className="met-text big">Game is final.</span><button className="fixed ghost" onClick={() => reopenGame(game.id)}>Reopen</button></>
        ) : (
          <button className="primary" onClick={() => confirm('Mark game final?') && finalizeGame(game.id)}>Mark game final</button>
        )}
        <button className="fixed ghost" onClick={() => go('games')}>Games</button>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="primary" onClick={() => doShare('MPR summary', text)}>Share summary text</button>
          <button onClick={() => doShare('MPR summary', summaryCsv(teams), `mpr-summary-${slug}.csv`)}>Summary CSV</button>
          <button onClick={() => doShare('MPR play log', playLogCsv(plays, s.players, s.teams), `mpr-playlog-${slug}.csv`)}>Play log CSV</button>
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>
      <div className="card">
        {teams.map(({ team, status }) => (
          <div key={team.id} style={{ marginBottom: 16 }}>
            <h2 style={{ color: team.isHomeTeam ? '#93c5fd' : '#fca5a5' }}>{team.name} · min {status.threshold} · {status.met} met / {status.short} short</h2>
            <table className="status-table" style={{ fontSize: 18 }}>
              <thead><tr><th>#</th><th>Name</th><th>Plays</th><th>Met</th></tr></thead>
              <tbody>
                {status.lines.map((l) => (
                  <tr key={l.player.id}><td className="num" style={{ fontSize: 20 }}>{l.player.jersey}</td><td>{l.player.name}</td><td>{l.played}</td><td className={l.remaining === 0 ? 'met-text' : 'short-text'}>{l.remaining === 0 ? 'Y' : `N (${l.remaining})`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
