/**
 * Vercel Serverless Function: /api/scan
 *
 * Acionada pelo Vercel Cron como REDE DE SEGURANÇA (varrimento periódico).
 * Encaminha para a Edge Function `scan-odds` do Supabase, que detém a chave
 * OddsPapi e faz o trabalho pesado.
 *
 * NOTA DE FRESCURA: o Vercel Cron é grosseiro (1 min é o mais rápido em planos
 * pagos; Hobby é diário). Para tempo quase real (3–10s pré-jogo, sub-segundo
 * in-play) usa-se o WebSocket da OddsPapi num worker persistente que faz push
 * direto para `value_bets` (Supabase Realtime → frontend). Este cron garante
 * que nada fica preso se o WS cair. Ver README → "Tempo real".
 */
export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  const fnUrl = process.env.SUPABASE_FUNCTION_URL; // .../functions/v1/scan-odds
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fnUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'env em falta' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
