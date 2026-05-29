const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
);

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Supabase env vars ausentes." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse({ error: "Nao autenticado." }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const delaySeconds = Math.min(Math.max(Number(body.delay_seconds || 60), 10), 300);

  EdgeRuntime.waitUntil((async () => {
    await sleep(delaySeconds * 1000);

    await fetch(`${supabaseUrl}/functions/v1/enviar-push`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "self_test",
        empresa_id: body.empresa_id,
        titulo: body.titulo || "Teste com app fechado",
        corpo: body.corpo || "Esta notificacao foi enviada 1 minuto depois pelo servidor.",
        tipo: body.tipo || "teste_push_atrasado",
        dados: body.dados || {},
      }),
    });
  })());

  return jsonResponse({
    ok: true,
    scheduled: true,
    delay_seconds: delaySeconds,
  });
});
