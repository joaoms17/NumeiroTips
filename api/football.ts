/**
 * Vercel Edge Function: proxy para a API-Football.
 *
 * Porquê: a API-Football (api-sports.io) bloqueia chamadas diretas do browser
 * por CORS. Este proxy é chamado em mesma-origem (/api/football?path=...),
 * adiciona a chave (que fica no SERVIDOR, não no bundle) e encaminha.
 *
 * Env: API_FOOTBALL_KEY (preferido) ou VITE_API_FOOTBALL_KEY (também funciona,
 * pois a Vercel expõe todas as env vars às funções).
 */
export const config = { runtime: 'edge' };

const API_BASE = 'https://v3.football.api-sports.io';
const ALLOWED = /^\/(teams|fixtures|leagues|status|standings)(\/[a-z]+)?(\?.*)?$/i;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? '';

  if (!ALLOWED.test(path)) {
    return json({ error: 'path não permitido' }, 400);
  }
  const key = process.env.API_FOOTBALL_KEY ?? process.env.VITE_API_FOOTBALL_KEY;
  if (!key) {
    return json({ error: 'API_FOOTBALL_KEY não configurada no servidor' }, 500);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'x-apisports-key': key },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'private, max-age=300',
        'x-ratelimit-requests-remaining':
          res.headers.get('x-ratelimit-requests-remaining') ?? '',
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
