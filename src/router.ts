import { useEffect, useState } from 'react';

export type Route =
  | { name: 'season' }
  | { name: 'games' }
  | { name: 'setup'; gameId: string }
  | { name: 'live' }
  | { name: 'status' }
  | { name: 'log' }
  | { name: 'export' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'games': return { name: 'games' };
    case 'setup': return parts[1] ? { name: 'setup', gameId: parts[1] } : { name: 'games' };
    case 'live': return { name: 'live' };
    case 'status': return { name: 'status' };
    case 'log': return { name: 'log' };
    case 'export': return { name: 'export' };
    case 'season': return { name: 'season' };
    default: return { name: 'live' };
  }
}

export function go(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#/${path}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
