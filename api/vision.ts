/**
 * Vercel Edge Function: lê um PRINT de um jogo (onze / notas) com Gemini Vision
 * e devolve os jogadores estruturados (lado, número, nome, nota, titular).
 *
 * Usado pelo painel admin "✏️ dados" → "📷 importar imagem". A chave fica SÓ no
 * servidor (GEMINI_API_KEY). Sem ela, devolve 503 e o admin cola o bloco à mão.
 */
export const config = { runtime: 'edge' };

interface VisionBody {
  images?: string[]; // base64 SEM prefixo data:
  mime?: string;
  homeName?: string;
  awayName?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'usa POST' }, 405);
  if (!process.env.GEMINI_API_KEY) {
    return json({ error: 'sem GEMINI_API_KEY no servidor — cola o bloco à mão.' }, 503);
  }

  let body: VisionBody;
  try {
    body = (await req.json()) as VisionBody;
  } catch {
    return json({ error: 'corpo inválido' }, 400);
  }
  const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  if (images.length === 0) return json({ error: 'sem imagens' }, 400);
  const homeName = body.homeName ?? 'casa';
  const awayName = body.awayName ?? 'fora';
  const mime = body.mime ?? 'image/jpeg';

  const prompt = `Estas imagens são prints de um jogo de futebol entre ${homeName} (casa) e ${awayName} (fora) — onze inicial e/ou notas (ratings) dos jogadores, estilo FlashScore/SofaScore.
Extrai TODOS os jogadores visíveis. Devolve SÓ um objeto JSON com a forma:
{"players":[{"side":"home"|"away","number":<int|null>,"name":"<nome>","rating":<number|null>,"starter":<true|false>}]}
Regras:
- side: "home" se for do ${homeName}, "away" se for do ${awayName}.
- number: número da camisola (inteiro) se visível, senão null.
- name: nome exatamente como aparece.
- rating: a nota (ex. 7.4) se houver, senão null.
- starter: true se for titular (onze), false se for suplente; se não der para saber, usa true.
- NÃO inventes jogadores nem notas. Inclui titulares e suplentes que tenham nota.`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const data of images) parts.push({ inline_data: { mime_type: mime, data } });

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const gbody = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(gbody) },
    );
    const data = await res.json();
    if (!res.ok) return json({ error: data?.error?.message ?? `Gemini HTTP ${res.status}` }, 502);
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim() ?? '';
    let parsed: { players?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'resposta da IA ilegível' }, 502);
    }
    return json({ players: Array.isArray(parsed.players) ? parsed.players : [] }, 200);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
