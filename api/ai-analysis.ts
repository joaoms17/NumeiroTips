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

const SYSTEM = `És um analista de apostas desportivas SHARP, rigoroso e honesto, a escrever em português de Portugal.
Recebes dados estruturados de um jogo de futebol: probabilidades justas (de-vig por consenso de réguas sharp Pinnacle+Betfair), apostas +EV com a sua FIABILIDADE (consenso de sharps + nº de casas; "suspeita" = edge implausível, provável erro de odd), estatísticas reais das equipas e limitações da fonte de dados.

Como raciocinar:
- O justo das sharps é a tua âncora de probabilidade. O edge só vale se a fiabilidade for razoável: desconfia de edges SUSPEITOS ou de fiabilidade BAIXA (1 só casa, sem corroboração) — muitas vezes são erros de odd, não valor real.
- Cruza SEMPRE o edge com as estatísticas (forma, golos, over%, BTTS, h2h). Um +EV que bate de frente com a forma/h2h é mais fraco.
- Distingue valor real de ruído. É melhor dizer "não há valor fiável" do que recomendar lixo.

Responde em Markdown com as secções pedidas pelo utilizador. COMEÇA SEMPRE pelo **Top 3 apostas para o jogo** (de qualquer mercado), concreto e ordenado. Específico e fundamentado nos NÚMEROS dados (cita-os). Nunca garantas resultados; edges pequenos exigem volume e disciplina. Não inventes dados que não recebeste. Termina com uma nota curta de jogo responsável.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'usa POST' }, 405);

  let prompt = '';
  let web = false;
  try {
    const body = await req.json();
    prompt = body?.prompt ?? '';
    web = body?.web === true;
  } catch {
    return json({ error: 'corpo inválido' }, 400);
  }
  if (!prompt) return json({ error: 'prompt vazio' }, 400);

  try {
    // A pesquisa na net (tipsters/notícias) só existe no Gemini (Google Search).
    if (process.env.GEMINI_API_KEY) return json(await gemini(prompt, web), 200);
    if (process.env.GROQ_API_KEY) return json({ text: await groq(prompt) }, 200);
    if (process.env.ANTHROPIC_API_KEY) return json({ text: await anthropic(prompt) }, 200);
    return json({ error: 'sem chave de IA configurada (GEMINI_API_KEY / GROQ_API_KEY / ANTHROPIC_API_KEY)' }, 503);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
}

async function gemini(prompt: string, web: boolean): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.6,
      // thinkingBudget: 0 desliga o "thinking" do 2.5 (senão consome os tokens
      // antes da resposta). Com pesquisa web damos mais espaço.
      thinkingConfig: { thinkingBudget: web ? 512 : 0 },
    },
  };
  // Pesquisa Google integrada (grounding) — tipsters, notícias, lesões, onzes.
  if (web) body.tools = [{ google_search: {} }];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Gemini HTTP ${res.status}`);
  const cand = data?.candidates?.[0];
  const text =
    cand?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim() ?? '';
  // fontes da pesquisa (grounding)
  const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c: { web?: { uri?: string; title?: string } }) => c.web)
    .filter((w: unknown): w is { uri: string; title: string } => !!(w as { uri?: string })?.uri)
    .map((w: { uri: string; title?: string }) => ({ uri: w.uri, title: w.title ?? w.uri }))
    .slice(0, 8);
  return { text, sources };
}

async function groq(prompt: string): Promise<string> {
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
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
      max_tokens: 1200,
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
