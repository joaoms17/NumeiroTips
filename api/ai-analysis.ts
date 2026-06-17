/**
 * Vercel Edge Function: visão AI de um jogo (via Claude / Anthropic API).
 *
 * O frontend envia um resumo do jogo (odds, edges, stats) e recebe uma análise
 * em linguagem natural. A chave fica no SERVIDOR (ANTHROPIC_API_KEY).
 * Modelo configurável (ANTHROPIC_MODEL); por defeito um modelo rápido/barato.
 *
 * Sem chave configurada, devolve 503 e o frontend mostra a análise determinística.
 */
export const config = { runtime: 'edge' };

const SYSTEM = `És um analista de apostas desportivas sharp e honesto, a escrever em português de Portugal.
Recebes dados de um jogo: odds justas (de réguas sharp), odds das casas, edges (+EV) e estatísticas das equipas.
Escreve uma análise CONCISA (máx ~180 palavras) e prática:
- a leitura do jogo (forma, golos, h2h);
- onde está o valor (as apostas +EV mais credíveis e porquê);
- riscos/ressalvas.
Regras: nunca garantas resultados; lembra que edges pequenos exigem volume; não inventes dados que não foram dados. Termina com uma nota curta de jogo responsável.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'usa POST' }, 405);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' }, 503);

  let prompt = '';
  try {
    prompt = (await req.json())?.prompt ?? '';
  } catch {
    return json({ error: 'corpo inválido' }, 400);
  }
  if (!prompt) return json({ error: 'prompt vazio' }, 400);

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return json({ error: data?.error?.message ?? `Anthropic HTTP ${res.status}` }, 502);
    }
    const text = Array.isArray(data?.content)
      ? data.content.map((b: { text?: string }) => b.text ?? '').join('\n').trim()
      : '';
    return json({ text });
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
