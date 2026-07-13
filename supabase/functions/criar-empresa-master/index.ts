import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const limparTelefone = (valor: unknown) => String(valor ?? "").replace(/\D/g, "");
const criarSlug = (valor: unknown) => String(valor ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

async function limparCriacao(adminClient: ReturnType<typeof createClient>, empresaId: string | null, userId: string | null) {
  if (empresaId) {
    await adminClient.from("agendamentos").delete().eq("empresa_id", empresaId);
    await adminClient.from("historico_cortes").delete().eq("empresa_id", empresaId);
    await adminClient.from("assinaturas").delete().eq("empresa_id", empresaId);
    await adminClient.from("horarios_funcionamento").delete().eq("empresa_id", empresaId);
    await adminClient.from("barbeiros").delete().eq("empresa_id", empresaId);
    await adminClient.from("filiais").delete().eq("empresa_id", empresaId);
    await adminClient.from("servicos").delete().eq("empresa_id", empresaId);
    await adminClient.from("planos").delete().eq("empresa_id", empresaId);
    await adminClient.from("configuracoes").delete().eq("empresa_id", empresaId);
    await adminClient.from("usuarios_empresas").delete().eq("empresa_id", empresaId);
    await adminClient.from("clientes").delete().eq("empresa_id", empresaId);
    await adminClient.from("empresas").delete().eq("id", empresaId);
  }

  if (userId) await adminClient.auth.admin.deleteUser(userId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Variaveis do Supabase nao configuradas." }, 500);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "Login obrigatorio." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessao invalida." }, 401);

  const { data: master } = await adminClient
    .from("master_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!master) return json({ error: "Acesso master negado." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return json({ error: "Dados invalidos." }, 400);
  }

  const empresaNome = String(body.empresaNome ?? "").trim();
  const slug = criarSlug(body.slug || empresaNome);
  const empresaWhatsapp = limparTelefone(body.empresaWhatsapp);
  const chavePix = String(body.chavePix ?? empresaWhatsapp).trim();
  const donoNome = String(body.donoNome ?? "").trim();
  const donoEmail = String(body.donoEmail ?? "").trim().toLowerCase();
  const donoSenha = String(body.donoSenha ?? "");
  const filialNome = String(body.filialNome ?? "Matriz").trim() || "Matriz";
  const planoSistemaCodigo = String(body.planoSistemaCodigo ?? "").trim().toLowerCase();
  const valorMensal = Number(body.valorMensal ?? 0);
  const diaVencimento = Number(body.diaVencimento ?? 0);
  const primeiroVencimentoTexto = String(body.primeiroVencimento ?? "").trim();

  if (!empresaNome) return json({ error: "Informe o nome da empresa." }, 400);
  if (!slug || slug.length < 3) return json({ error: "Informe um slug valido com pelo menos 3 caracteres." }, 400);
  if (!donoNome) return json({ error: "Informe o nome do dono." }, 400);
  if (!donoEmail.includes("@")) return json({ error: "Informe um e-mail valido para o dono." }, 400);
  if (donoSenha.length < 6) return json({ error: "A senha temporaria precisa ter pelo menos 6 digitos." }, 400);

  const { data: planoSistema, error: planoSistemaError } = await adminClient
    .from("planos_sistema")
    .select("id, codigo, nome, sem_vencimento")
    .eq("codigo", planoSistemaCodigo)
    .eq("ativo", true)
    .maybeSingle();

  if (planoSistemaError || !planoSistema) return json({ error: "Selecione um plano valido da BarbeariaClick." }, 400);

  const semVencimento = Boolean(planoSistema.sem_vencimento);
  let primeiroVencimento: string | null = null;
  if (!semVencimento) {
    if (!Number.isFinite(valorMensal) || valorMensal <= 0) return json({ error: "Informe um valor mensal valido." }, 400);
    if (![5, 10, 15, 20].includes(diaVencimento)) return json({ error: "Selecione um dia de vencimento valido." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimentoTexto)) return json({ error: "Informe o primeiro vencimento." }, 400);

    const [ano, mes, dia] = primeiroVencimentoTexto.split("-").map(Number);
    const dataValida = new Date(Date.UTC(ano, mes - 1, dia));
    if (
      dataValida.getUTCFullYear() !== ano
      || dataValida.getUTCMonth() !== mes - 1
      || dataValida.getUTCDate() !== dia
      || dia !== diaVencimento
    ) {
      return json({ error: "O primeiro vencimento deve usar o dia selecionado." }, 400);
    }
    primeiroVencimento = primeiroVencimentoTexto;
  }

  const { data: slugExistente } = await adminClient.from("empresas").select("id").eq("slug", slug).maybeSingle();
  if (slugExistente) return json({ error: "Esse slug ja esta em uso." }, 409);

  let novoUserId: string | null = null;
  let novaEmpresaId: string | null = null;

  try {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: donoEmail,
      password: donoSenha,
      email_confirm: true,
      user_metadata: { nome: donoNome, empresa_slug: slug },
    });
    if (authError || !authData.user) throw new Error(authError?.message || "Erro ao criar usuario Auth.");
    novoUserId = authData.user.id;

    const { data: empresaData, error: empresaError } = await adminClient
      .from("empresas")
      .insert({ nome: empresaNome, slug, whatsapp: empresaWhatsapp, chave_pix: chavePix, ativa: true })
      .select("id, slug")
      .single();
    if (empresaError || !empresaData) throw new Error(empresaError?.message || "Erro ao criar empresa.");
    novaEmpresaId = empresaData.id;

    const { error: vinculoError } = await adminClient
      .from("usuarios_empresas")
      .insert({ user_id: novoUserId, empresa_id: novaEmpresaId, papel: "dono" });
    if (vinculoError) throw new Error(vinculoError.message);

    const { error: assinaturaSistemaError } = await adminClient
      .from("assinaturas_empresas")
      .insert({
        empresa_id: novaEmpresaId,
        plano_sistema_id: planoSistema.id,
        status: "ativo",
        valor_mensal: semVencimento ? 0 : valorMensal,
        dia_vencimento: semVencimento ? null : diaVencimento,
        proximo_vencimento: semVencimento ? null : primeiroVencimento,
      });
    if (assinaturaSistemaError) throw new Error(assinaturaSistemaError.message);

    const { error: configError } = await adminClient
      .from("configuracoes")
      .insert({ empresa_id: novaEmpresaId, chave: "fluxo_agendamento", valor: { agendamento_ativo: true } });
    if (configError) throw new Error(configError.message);

    const { error: planosError } = await adminClient.from("planos").insert([
      { empresa_id: novaEmpresaId, slug: "barba", nome: "So Barba", limite: 5, preco: 60, ativo: true },
      { empresa_id: novaEmpresaId, slug: "cabelo", nome: "So Cabelo", limite: 5, preco: 80, ativo: true },
      { empresa_id: novaEmpresaId, slug: "completo", nome: "Cabelo & Barba", limite: 5, preco: 130, ativo: true },
    ]);
    if (planosError) throw new Error(planosError.message);

    const { error: servicosError } = await adminClient.from("servicos").insert([
      { empresa_id: novaEmpresaId, nome: "CABELO", preco: 30, duracao_minutos: 45, ativo: true },
      { empresa_id: novaEmpresaId, nome: "CABELO & BARBA", preco: 50, duracao_minutos: 60, ativo: true },
      { empresa_id: novaEmpresaId, nome: "BARBA", preco: 20, duracao_minutos: 30, ativo: true },
    ]);
    if (servicosError) throw new Error(servicosError.message);

    const { data: filialData, error: filialError } = await adminClient
      .from("filiais")
      .insert({ empresa_id: novaEmpresaId, nome: filialNome, endereco: "", ativa: true })
      .select("id")
      .single();
    if (filialError || !filialData) throw new Error(filialError?.message || "Erro ao criar filial.");

    const { error: barbeiroError } = await adminClient
      .from("barbeiros")
      .insert({ empresa_id: novaEmpresaId, filial_id: filialData.id, nome: donoNome, ativo: true });
    if (barbeiroError) throw new Error(barbeiroError.message);

    const horarios = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
      empresa_id: novaEmpresaId,
      filial_id: filialData.id,
      dia_semana: dia,
      aberto: dia !== 0,
      horario_inicio: dia === 0 ? null : "08:00",
      horario_fim: dia === 0 ? null : "18:00",
      intervalo_inicio: dia === 0 ? null : "12:00",
      intervalo_fim: dia === 0 ? null : "13:00",
    }));
    const { error: horariosError } = await adminClient.from("horarios_funcionamento").insert(horarios);
    if (horariosError) throw new Error(horariosError.message);

    return json({
      ok: true,
      empresa: { id: novaEmpresaId, nome: empresaNome, slug },
      dono: { id: novoUserId, email: donoEmail },
      assinatura: {
        plano: planoSistema.nome,
        valor_mensal: semVencimento ? 0 : valorMensal,
        proximo_vencimento: semVencimento ? null : primeiroVencimento,
      },
      links: {
        login: `/${slug}`,
        admin: `/${slug}/admin/dashboard`,
        cadastro: `/${slug}/cadastro`,
      },
    });
  } catch (error) {
    await limparCriacao(adminClient, novaEmpresaId, novoUserId);
    return json({ error: error instanceof Error ? error.message : "Erro ao criar empresa." }, 400);
  }
});
