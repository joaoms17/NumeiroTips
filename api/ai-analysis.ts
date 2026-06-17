/**
 * Vercel Edge Function: visão AI de um jogo — MULTI-FORNECEDOR.
 *
 * Usa o primeiro que estiver configurado (todos têm tier GRÁTIS, menos a
 * Anthropic):
 *   1. GEMINI_API_KEY   → Google Gemini (grátis, recomendado)
 *   2. GROQ_API_KEY     → Groq / Llama (grátis, muito rápido)
 *   3. ANTHROPIC_API_KEY→ Claude (pago)
 *
 * A chave fica SÓ no servidor. Sem nenhuma, devolve 503 e o frontend mostra a
 * análise automática (determinística).
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

  let prompt = '';
  try {
    prompt = (await req.json())?.prompt ?? '';
  } catch {
    return json({ error: 'corpo inválido' }, 400);
  }
  if (!prompt) return json({ error: 'prompt vazio' }, 400);

  try {
    if (process.env.GEMINI_API_KEY) return json({ text: await gemini(prompt) }, 200);
    if (process.env.GROQ_API_KEY) return json({ text: await groq(prompt) }, 200);
    if (process.env.ANTHROPIC_API_KEY) return json({ text: await anthropic(prompt) }, 200);
    return json({ error: 'sem chave de IA configurada (GEMINI_API_KEY / GROQ_API_KEY / ANTHROPIC_API_KEY)' }, 503);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
}

async function gemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.6 },
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Gemini HTTP ${res.status}`);
  return (
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim() ?? ''
  );
}

async function groq(prompt: string): Promise<string> {
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.6,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Groq HTTP ${res.status}`);
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

async function anthropic(prompt: string): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
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
  if (!res.ok) throw new Error(data?.error?.message ?? `Anthropic HTTP ${res.status}`);
  return Array.isArray(data?.content)
    ? data.content.map((b: { text?: string }) => b.text ?? '').join('\n').trim()
    : '';
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
