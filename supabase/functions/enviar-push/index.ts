import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushBody = {
  empresa_id?: string;
  target_user_ids?: string[];
  titulo?: string;
  corpo?: string;
  tipo?: string;
  dados?: Record<string, unknown>;
  action?: "send";
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

const enviarParaDispositivos = async ({
  supabaseAdmin,
  subscriptions,
  targetUserIds,
  empresaId,
  titulo,
  corpo,
  tipo,
  dados,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
  targetUserIds: string[];
  empresaId: string;
  titulo: string;
  corpo: string;
  tipo: string;
  dados: Record<string, unknown>;
}) => {
  await supabaseAdmin.from("notificacoes").insert(
    targetUserIds.map((userId) => ({
      empresa_id: empresaId,
      user_id: userId,
      titulo,
      corpo,
      tipo,
      dados,
    })),
  );

  const payload = JSON.stringify({
    title: titulo,
    body: corpo,
    tag: tipo,
    data: dados,
  });

  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload);
      return { id: subscription.id, ok: true };
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 0;

      if ([404, 410].includes(statusCode)) {
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
      }

      return { id: subscription.id, ok: false, statusCode };
    }
  }));

  const sent = results.filter((result) => result.status === "fulfilled" && result.value.ok).length;

  return {
    sent,
    failed: results.length - sent,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte.barbeariaclick@gmail.com";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env vars ausentes." }, 500);
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: "Chaves VAPID nao configuradas." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Nao autenticado." }, 401);
  }

  const body = await req.json().catch(() => ({})) as PushBody;
  const empresaId = body.empresa_id;
  const action = body.action || "send";

  if (!empresaId) {
    return jsonResponse({ error: "empresa_id obrigatorio." }, 400);
  }

  if (action !== "send") {
    return jsonResponse({ error: "Acao indisponivel." }, 400);
  }

  const { data: vinculo, error: vinculoError } = await supabaseAdmin
    .from("usuarios_empresas")
    .select("papel")
    .eq("empresa_id", empresaId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (vinculoError) {
    return jsonResponse({ error: "Erro ao validar permissao." }, 500);
  }

  if (!vinculo) {
    return jsonResponse({ error: "Usuario sem acesso a empresa." }, 403);
  }

  const isAdmin = ["dono", "admin"].includes(vinculo.papel);
  const targetUserIds = [...new Set(body.target_user_ids || [])].slice(0, 50);

  if (!isAdmin) {
    return jsonResponse({ error: "Apenas administradores podem enviar para terceiros." }, 403);
  }

  if (targetUserIds.length === 0) {
    return jsonResponse({ error: "Nenhum destinatario informado." }, 400);
  }

  const titulo = String(body.titulo || "BarbeariaClick").slice(0, 80);
  const corpo = String(body.corpo || "Voce tem uma nova atualizacao.").slice(0, 180);
  const tipo = String(body.tipo || "geral").slice(0, 40);
  const dados = body.dados && typeof body.dados === "object" ? body.dados : {};

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("empresa_id", empresaId)
    .eq("enabled", true)
    .in("user_id", targetUserIds);

  if (subscriptionsError) {
    return jsonResponse({ error: "Erro ao buscar dispositivos." }, 500);
  }

  const dispositivos = subscriptions || [];

  const { sent, failed } = await enviarParaDispositivos({
    supabaseAdmin,
    subscriptions: dispositivos,
    targetUserIds,
    empresaId,
    titulo,
    corpo,
    tipo,
    dados,
  });

  return jsonResponse({
    ok: true,
    targeted_users: targetUserIds.length,
    devices: dispositivos.length,
    sent,
    failed,
  });
});
