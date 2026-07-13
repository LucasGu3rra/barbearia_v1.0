create index if not exists assinaturas_empresas_plano_sistema_id_idx
  on public.assinaturas_empresas (plano_sistema_id);

create index if not exists mensalidades_empresas_assinatura_empresa_id_idx
  on public.mensalidades_empresas (assinatura_empresa_id);

create index if not exists mensalidades_empresas_confirmado_por_idx
  on public.mensalidades_empresas (confirmado_por);

create index if not exists assinaturas_empresas_eventos_assinatura_empresa_id_idx
  on public.assinaturas_empresas_eventos (assinatura_empresa_id);

create index if not exists assinaturas_empresas_eventos_realizado_por_idx
  on public.assinaturas_empresas_eventos (realizado_por);

create index if not exists plano_sistema_recursos_recurso_codigo_idx
  on public.plano_sistema_recursos (recurso_codigo);
