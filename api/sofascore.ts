/**
 * Vercel Edge Function: proxy para a API (não-oficial) do SofaScore.
 *
 * Porquê: o SofaScore bloqueia chamadas diretas do browser (CORS) e por
 * User-Agent. Este proxy chama em mesma-origem (/api/sofascore?path=...),
 * adiciona headers de browser e encaminha. Usado para jogos, onzes e RATINGS
 * ao vivo do Mundial 2026 (gratuito, cobre a época atual).
 *
 * NOTA: o SofaScore está atrás de Cloudflare e pode devolver 403 a IPs de
 * datacenter (Vercel). Se isso acontecer, o cliente cai no fallback curado.
 */
export const config = { runtime: 'edge' };

const BASE = 'https://api.sofascore.com/api/v1';
// só caminhos de leitura que usamos
const ALLOWED = /^\/(sport\/football\/scheduled-events\/[\d-]+|event\/\d+(\/lineups)?)$/;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? '';

  if (!ALLOWED.test(path)) {
    return json({ error: 'path não permitido' }, 400);
  }

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.sofascore.com/',
        Origin: 'https://www.sofascore.com',
      },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json',
        // ao vivo muda depressa → cache curto
        'cache-control': 'public, max-age=30',
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
