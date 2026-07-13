import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  agendamento_id?: string;
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
  eventoId,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  empresaId: string;
  targetUserIds: string[];
  titulo: string;
  corpo: string;
  tipo: string;
  dados: Record<string, unknown>;
  eventoId: string;
}) => {
  const destinatarios = [...new Set(targetUserIds.filter(Boolean))];
  if (destinatarios.length === 0) return { targeted: 0, devices: 0, sent: 0, failed: 0 };

  const { error: notificacoesError } = await supabaseAdmin.from("notificacoes").upsert(
    destinatarios.map((userId) => ({
      empresa_id: empresaId,
      user_id: userId,
      titulo,
      corpo,
      tipo,
      dados,
      evento_agendamento_id: eventoId,
    })),
    {
      onConflict: "evento_agendamento_id,user_id",
      ignoreDuplicates: true,
    },
  );

  if (notificacoesError) throw notificacoesError;

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

  if (!body.agendamento_id) {
    return jsonResponse({ error: "Dados invalidos." }, 400);
  }

  const { data: agendamento, error: agendamentoError } = await supabaseAdmin
    .from("agendamentos")
    .select(`
      id, empresa_id, cliente_id, barbeiro_id, data_hora, tipo_cliente, duracao_minutos, status,
      clientes(nome),
      servicos(nome),
      planos(nome),
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

  const { data: eventosPendentes, error: eventosError } = await supabaseAdmin
    .from("agendamento_notificacao_eventos")
    .select("id, evento, created_at")
    .eq("agendamento_id", agendamento.id)
    .is("processado_em", null)
    .order("created_at", { ascending: true });

  if (eventosError) {
    return jsonResponse({ error: "Erro ao buscar eventos de notificacao." }, 500);
  }

  if (!eventosPendentes?.length) {
    return jsonResponse({ ok: true, processados: 0, duplicado: true });
  }

  const { data: admins, error: adminsError } = await supabaseAdmin
    .from("usuarios_empresas")
    .select("user_id")
    .eq("empresa_id", agendamento.empresa_id)
    .in("papel", ["dono", "admin"]);

  if (adminsError) {
    return jsonResponse({ error: "Erro ao buscar destinatarios." }, 500);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const nomeCliente = agendamento.clientes?.nome || "Cliente";
  const nomeServico = agendamento.planos?.nome || agendamento.servicos?.nome || "Servico";
  const quando = formatarPartesDataHora(agendamento.data_hora);
  const empresaSlug = agendamento.empresas?.slug;
  const urlCliente = montarUrl(empresaSlug, "dashboard");
  const urlAdmin = montarUrl(empresaSlug, "admin/dashboard");
  const urlBarbeiro = montarUrl(empresaSlug, "barbeiro/dashboard");

  const usuariosAdmin = [...new Set(
    (admins || [])
      .map((admin) => admin.user_id)
      .filter((userId) => userId && userId !== agendamento.cliente_id),
  )];
  const usuariosBarbeiro = agendamento.barbeiros?.user_id
    && agendamento.barbeiros.user_id !== agendamento.cliente_id
    && !usuariosAdmin.includes(agendamento.barbeiros.user_id)
    ? [agendamento.barbeiros.user_id]
    : [];

  const resultados = [];
  let processados = 0;

  for (const eventoPendente of eventosPendentes) {
    const { data: evento, error: claimError } = await supabaseAdmin
      .rpc("reivindicar_evento_notificacao_agendamento", {
        p_evento_id: eventoPendente.id,
      });

    if (claimError) {
      return jsonResponse({ error: "Erro ao reservar evento de notificacao." }, 500);
    }

    if (!evento?.id) continue;

    try {
      if (evento.evento === "criado") {
        resultados.push(await enviarPush({
          supabaseAdmin,
          empresaId: agendamento.empresa_id,
          targetUserIds: [agendamento.cliente_id],
          titulo: "Agendamento confirmado",
          corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}.`,
          tipo: "agendamento_confirmado",
          dados: { url: urlCliente, agendamento_id: agendamento.id },
          eventoId: evento.id,
        }));

        resultados.push(await enviarPush({
          supabaseAdmin,
          empresaId: agendamento.empresa_id,
          targetUserIds: usuariosAdmin,
          titulo: "Novo agendamento!",
          corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}. Cliente: ${nomeCliente}.`,
          tipo: "novo_agendamento",
          dados: { url: urlAdmin, agendamento_id: agendamento.id },
          eventoId: evento.id,
        }));

        resultados.push(await enviarPush({
          supabaseAdmin,
          empresaId: agendamento.empresa_id,
          targetUserIds: usuariosBarbeiro,
          titulo: "Novo agendamento!",
          corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}. Cliente: ${nomeCliente}.`,
          tipo: "novo_agendamento",
          dados: { url: urlBarbeiro, agendamento_id: agendamento.id },
          eventoId: evento.id,
        }));
      }

      if (evento.evento === "cancelado") {
        resultados.push(await enviarPush({
          supabaseAdmin,
          empresaId: agendamento.empresa_id,
          targetUserIds: [agendamento.cliente_id],
          titulo: "Agendamento cancelado",
          corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}.`,
          tipo: "agendamento_cancelado",
          dados: { url: urlCliente, agendamento_id: agendamento.id },
          eventoId: evento.id,
        }));

        resultados.push(await enviarPush({
          supabaseAdmin,
          empresaId: agendamento.empresa_id,
          targetUserIds: usuariosAdmin,
          titulo: "Agendamento cancelado",
          corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}. Cliente: ${nomeCliente}.`,
          tipo: "agendamento_cancelado",
          dados: { url: urlAdmin, agendamento_id: agendamento.id },
          eventoId: evento.id,
        }));

        resultados.push(await enviarPush({
          supabaseAdmin,
          empresaId: agendamento.empresa_id,
          targetUserIds: usuariosBarbeiro,
          titulo: "Agendamento cancelado",
          corpo: `Servico: ${nomeServico}. Data: ${quando.data}. Horario: ${quando.hora}. Cliente: ${nomeCliente}.`,
          tipo: "agendamento_cancelado",
          dados: { url: urlBarbeiro, agendamento_id: agendamento.id },
          eventoId: evento.id,
        }));
      }

      const { error: concluirError } = await supabaseAdmin
        .from("agendamento_notificacao_eventos")
        .update({
          processado_em: new Date().toISOString(),
          processando_em: null,
          ultimo_erro: null,
        })
        .eq("id", evento.id);

      if (concluirError) throw concluirError;
      processados += 1;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Falha ao enviar notificacao.";
      await supabaseAdmin
        .from("agendamento_notificacao_eventos")
        .update({
          processando_em: null,
          ultimo_erro: mensagem.slice(0, 500),
        })
        .eq("id", evento.id);

      return jsonResponse({ error: "Erro ao processar notificacao." }, 500);
    }
  }

  return jsonResponse({
    ok: true,
    processados,
    resultados,
  });
});
