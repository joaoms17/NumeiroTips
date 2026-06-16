/**
 * Edge Function: telegram-alert
 * =============================
 *
 * Envia um alerta para o Telegram quando surge uma value bet qualificada.
 * Pode ser invocada:
 *   - por um Database Webhook do Supabase em INSERT/UPDATE de `value_bets`
 *     (payload.record), ou
 *   - manualmente com um corpo { edgeMin } para varrer as value bets ativas.
 *
 * Nunca coloca apostas — só notifica. Segredos: TELEGRAM_BOT_TOKEN,
 * TELEGRAM_CHAT_ID.
 */
// @ts-nocheck Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EDGE_MIN = Number(Deno.env.get("ALERT_EDGE_MIN") ?? "0.03");

async function sendTelegram(text: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    console.warn("[telegram-alert] falta TELEGRAM_BOT_TOKEN/CHAT_ID");
    return;
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

function format(vb: any): string {
  const edge = (Number(vb.edge) * 100).toFixed(1);
  const book = String(vb.book_id).toUpperCase();
  return [
    `⚡ <b>Value Bet</b> · edge <b>${edge}%</b>`,
    `${vb.market_id}`,
    `${book} @ <b>${Number(vb.odd_casa).toFixed(2)}</b> (justa ${Number(vb.odd_justa).toFixed(2)})`,
    `stake sugerido: ${vb.stake ?? "—"}€`,
  ].join("\n");
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    // Caso 1: webhook de DB com um único record.
    if (body?.record) {
      const vb = body.record;
      if (Number(vb.edge) >= EDGE_MIN && vb.estado === "ativo") {
        await sendTelegram(format(vb));
      }
      return Response.json({ ok: true, mode: "webhook" });
    }

    // Caso 2: varrimento manual.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const edgeMin = Number(body?.edgeMin ?? EDGE_MIN);
    const { data, error } = await supabase
      .from("value_bets")
      .select("*")
      .eq("estado", "ativo")
      .gte("edge", edgeMin)
      .order("edge", { ascending: false })
      .limit(10);
    if (error) throw error;

    for (const vb of data ?? []) await sendTelegram(format(vb));
    return Response.json({ ok: true, sent: data?.length ?? 0 });
  } catch (e) {
    console.error("[telegram-alert]", e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
