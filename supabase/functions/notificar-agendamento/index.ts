import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventoAgendamento = "criado" | "cancelado" | "excluido";

type Body = {
  agendamento_id?: string;
  evento?: EventoAgendamento;
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

const formatarPartesDataHora = (valor?: string) => {
  const fallback = { data: "Data nao informada", hora: "Horario nao informado" };
  if (!valor) return fallback;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return fallback;
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(data);
  const horaFormatada = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(data);

  return {
    data: dataFormatada,
    hora: horaFormatada,
  };
};

const montarUrl = (empresaSlug?: string, destino = "dashboard") => {
  if (!empresaSlug) return "/";
  return `/${[empresaSlug, destino].filter(Boolean).join("/")}`;
};

const enviarPush = async ({
  supabaseAdmin,
  empresaId,
  targetUserIds,
  titulo,
  corpo,
  tipo,
  dados,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  empresaId: string;
  targetUserIds: string[];
  titulo: string;
  corpo: string;
  tipo: string;
  dados: Record<string, unknown>;
}) => {
  const destinatarios = [...new Set(targetUserIds.filter(Boolean))];
  if (destinatarios.length === 0) return { targeted: 0, devices: 0, sent: 0, failed: 0 };

  await supabaseAdmin.from("notificacoes").insert(
    destinatarios.map((userId) => ({
      empresa_id: empresaId,
      user_id: userId,
      titulo,
      corpo,
      tipo,
      dados,
    })),
  );

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("empresa_id", empresaId)
    .eq("enabled", true)
    .in("user_id", destinatarios);

  if (error) throw error;

  const payload = JSON.stringify({
    title: titulo,
    body: corpo,
    tag: tipo,
    data: dados,
  });

  const results = await Promise.allSettled((subscriptions || []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload);
      return { ok: true };
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

      return { ok: false };
    }
  }));

  const sent = results.filter((result) => result.status === "fulfilled" && result.value.ok).length;

  return {
    targeted: destinatarios.length,
    devices: subscriptions?.length || 0,
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

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: "Ambiente de push incompleto." }, 500);
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

  const body = await req.json().catch(() => ({})) as Body;
  const evento = body.evento;

  if (!body.agendamento_id || !["criado", "cancelado", "excluido"].includes(String(evento))) {
    return jsonResponse({ error: "Dados invalidos." }, 400);
  }

  const { data: agendamento, error: agendamentoError } = await supabaseAdmin
    .from("agendamentos")
    .select(`
      id, empresa_id, cliente_id, barbeiro_id, data_hora, tipo_cliente, duracao_minutos, status,
      clientes(nome),
      servicos(nome),
      filiais(nome),
      barbeiros(nome, user_id),
      empresas(slug)
    `)
    .eq("id", body.agendamento_id)
    .maybeSingle();

  if (agendamentoError) {
    return jsonResponse({ error: "Erro ao buscar agendamento." }, 500);
  }

  if (!agendamento) {
    return jsonResponse({ error: "Agendamento nao encontrado." }, 404);
  }

  const { data: vinculo } = await supabaseAdmin
    .from("usuarios_empresas")
    .select("papel")
    .eq("empresa_id", agendamento.empresa_id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const usuarioEhClienteDoAgendamento = agendamento.cliente_id === authData.user.id;
  const usuarioEhEquipeAutorizada = ["dono", "admin"].includes(vinculo?.papel || "")
    || agendamento.barbeiros?.user_id === authData.user.id;

  if (!usuarioEhClienteDoAgendamento && !usuarioEhEquipeAutorizada) {
    return jsonResponse({ error: "Usuario sem acesso ao agendamento." }, 403);
  }

  const { data: admins } = await supabaseAdmin
    .from("usuarios_empresas")
    .select("user_id")
    .eq("empresa_id", agendamento.empresa_id)
    .in("papel", ["dono", "admin"]);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const nomeCliente = agendamento.clientes?.nome || "Cliente";
  const nomeServico = agendamento.servicos?.nome || "Servico";
  const quando = formatarPartesDataHora(agendamento.data_hora);
  const empresaSlug = agendamento.empresas?.slug;
  const urlCliente = montarUrl(empresaSlug, "dashboard");
  const urlPainel = montarUrl(empresaSlug, "dashboard");

  const usuariosEquipe = [
    ...(admins || []).map((admin) => admin.user_id),
    agendamento.barbeiros?.user_id,
  ].filter((userId) => userId && userId !== agendamento.cliente_id);

  const eventoCancelamento = evento === "cancelado" || evento === "excluido";
  const resultados = [];

  if (evento === "criado") {
    resultados.push(await enviarPush({
      supabaseAdmin,
      empresaId: agendamento.empresa_id,
      targetUserIds: [agendamento.cliente_id],
      titulo: "Agendamento confirmado",
      corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}.`,
      tipo: "agendamento_confirmado",
      dados: { url: urlCliente, agendamento_id: agendamento.id },
    }));

    resultados.push(await enviarPush({
      supabaseAdmin,
      empresaId: agendamento.empresa_id,
      targetUserIds: usuariosEquipe,
      titulo: "Novo agendamento!",
      corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}. Cliente: ${nomeCliente}.`,
      tipo: "novo_agendamento",
      dados: { url: urlPainel, agendamento_id: agendamento.id },
    }));
  }

  if (eventoCancelamento) {
    resultados.push(await enviarPush({
      supabaseAdmin,
      empresaId: agendamento.empresa_id,
      targetUserIds: [agendamento.cliente_id],
      titulo: "Agendamento cancelado",
      corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}.`,
      tipo: "agendamento_cancelado",
      dados: { url: urlCliente, agendamento_id: agendamento.id },
    }));

    resultados.push(await enviarPush({
      supabaseAdmin,
      empresaId: agendamento.empresa_id,
      targetUserIds: usuariosEquipe,
      titulo: "Agendamento cancelado",
      corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}. Cliente: ${nomeCliente}.`,
      tipo: "agendamento_cancelado",
      dados: { url: urlPainel, agendamento_id: agendamento.id },
    }));
  }

  return jsonResponse({
    ok: true,
    evento,
    resultados,
  });
});
