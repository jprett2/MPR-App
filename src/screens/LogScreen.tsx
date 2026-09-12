import { useState } from 'react';
import { periodLabel, playTypeDef, visiblePlayTypes } from '../config/rules';
import { dressedPlayers, gamePlays, rulesForSeason, useApp } from '../store/useApp';
import type { Game, Play } from '../types';

export function LogScreen({ game }: { game: Game }) {
  const s = useApp();
  const { reclassifyPlay, setPlayVoided, setPlayParticipants } = useApp.getState();
  const [openId, setOpenId] = useState<string | null>(null);
  const rules = rulesForSeason(s, game.seasonId);
  const plays = gamePlays(s, game.id).slice().reverse();
  const teams = [s.teams.find((t) => t.id === game.homeTeamId)!, s.teams.find((t) => t.id === game.opponentTeamId)!];
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const types = visiblePlayTypes(rules);

  const jerseys = (p: Play, teamId: string) =>
    p.participants.filter((x) => x.teamId === teamId).map((x) => byId.get(x.playerId)?.jersey ?? '?').sort((a, b) => Number(a) - Number(b)).join(' ');

  const toggleParticipant = (p: Play, teamId: string, playerId: string) => {
    const has = p.participants.some((x) => x.playerId === playerId);
    const next = has ? p.participants.filter((x) => x.playerId !== playerId) : [...p.participants, { playerId, teamId }];
    void setPlayParticipants(p.id, next);
  };

  return (
    <div className="screen">
      <div className="card" style={{ padding: 0 }}>
        {plays.length === 0 && <div className="muted" style={{ padding: 16 }}>No plays logged.</div>}
        {plays.map((p) => (
          <div key={p.id}>
            <div className={`log-row ${p.voided ? 'voided' : ''}`} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
              <b>#{p.sequence}</b>
              <span>{periodLabel(p.period)}</span>
              <span className={p.counts ? '' : 'warn-text'}>{playTypeDef(p.playType).short}{p.counts ? '' : ' ✗'}</span>
              <div className="parts">
                {teams.map((t) => <div key={t.id}><b style={{ color: t.isHomeTeam ? '#93c5fd' : '#fca5a5' }}>{t.name}</b> {jerseys(p, t.id) || '—'}</div>)}
                {p.offenseTeamId && <div>🏈 {teams.find((t) => t.id === p.offenseTeamId)?.name}</div>}
              </div>
            </div>
            {openId === p.id && (
              <div className="card" style={{ margin: 8, background: 'var(--panel-2)' }}>
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="seg">
                    {types.map((t) => <button key={t.id} className={p.playType === t.id ? 'active' : ''} onClick={() => reclassifyPlay(p.id, t.id)}>{t.short}</button>)}
                  </div>
                  <button className={`fixed ${p.voided ? 'primary' : 'danger'}`} onClick={() => setPlayVoided(p.id, !p.voided)}>{p.voided ? 'Restore' : 'Void'}</button>
                </div>
                {teams.map((t) => (
                  <div key={t.id} style={{ marginBottom: 8 }}>
                    <div className="muted" style={{ marginBottom: 4 }}>{t.name}</div>
                    <div className="grid-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}>
                      {dressedPlayers(s, game.id, t.id).map((pl) => {
                        const on = p.participants.some((x) => x.playerId === pl.id);
                        return <button key={pl.id} className={`tile ${on ? 'on' : ''}`} style={{ minHeight: 52 }} onClick={() => toggleParticipant(p, t.id, pl.id)}><span className="num" style={{ fontSize: 20 }}>{pl.jersey}</span></button>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
