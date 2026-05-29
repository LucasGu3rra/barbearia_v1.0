import { AlertBox, HeroCard, Icon, SectionTitle } from '../../components/clientes/ClienteDashboardParts';
import ClienteServicoSelector from '../../components/clientes/ClienteServicoSelector';
import { formatarMoeda, parseDataSupabase } from '../utils/clienteDashboardUtils';

const dataValida = (valor) => {
  if (!valor) return null;
  const direta = new Date(valor);
  if (!Number.isNaN(direta.getTime())) return direta;
  const fallback = parseDataSupabase(valor);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatarDataAgendamento = (valor) => {
  const data = dataValida(valor);
  if (!data) return 'Sem data';

  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (data.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  if (data.toDateString() === amanha.toDateString()) return `Amanha, ${hora}`;
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`;
};

const detalheAgendamento = (agendamento) => {
  if (!agendamento) return 'O cliente pode ter apenas um agendamento ativo por vez.';

  return [
    agendamento.servicos?.nome || 'Servico',
    agendamento.barbeiros?.nome,
    agendamento.filiais?.nome,
  ].filter(Boolean).join(' - ');
};

function InfoCard({ label, title, subtitle, tone = 'strong' }) {
  return (
    <div className="bg-[#1b1b1b] border border-[#333] rounded-[14px] p-4 min-h-[112px]">
      <p className="text-[10px] text-zinc-400 font-bold">{label}</p>
      <p className={`${tone === 'muted' ? 'text-zinc-400 text-sm font-bold' : 'text-white text-xl font-black'} mt-3`}>{title}</p>
      {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function ActionCard({ icon, title, subtitle, onClick, disabled = false, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative bg-[#1b1b1b] border border-[#333] rounded-[14px] text-left transition-transform ${compact ? 'p-3 min-h-[92px]' : 'p-4 min-h-[112px]'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.99]'}`}
    >
      <div className={`${compact ? 'w-8 h-8 rounded-[10px] mb-2' : 'w-10 h-10 rounded-[12px] mb-3'} bg-[#2c281b] text-[#d5b451] flex items-center justify-center`}>
        <Icon name={icon} className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
      </div>
      <p className={`text-white font-black leading-tight ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      <p className={`text-zinc-500 mt-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>{subtitle}</p>
      <Icon name="chevron" className="absolute right-4 top-5 w-4 h-4 text-[#d5b451]" />
    </button>
  );
}

function PlanoCallout({ temPlanos, onAbrirPlanos }) {
  if (!temPlanos) return null;

  return (
    <button type="button" onClick={onAbrirPlanos} className="w-full text-left active:scale-[0.99] transition-transform">
      <AlertBox icon="crown">
        <strong>Assine um plano</strong> e economize em cada corte. Ver planos disponiveis.
      </AlertBox>
    </button>
  );
}

function PrimeiroUso({
  dados,
  servicosAvulsos,
  temPlanos,
  agendamentoAtivo,
  onAbrirPlanos,
  onAbrirAgendamentoSemPlano,
}) {
  return (
    <div className="page on avulso-dashboard">
      <div className="scroll">
        <HeroCard
          dados={dados}
          sub={`Cliente desde ${dados.clienteDesde || 'maio 2026'}`}
          status={{ icon: 'x', label: 'Sem plano ativo', variant: 'none' }}
          compact
        />

        <PlanoCallout temPlanos={temPlanos} onAbrirPlanos={onAbrirPlanos} />

        <h2 className="text-white text-lg font-black mb-1">Escolha seu servico</h2>

        {agendamentoAtivo ? (
          <ClienteServicoSelector
            servicos={servicosAvulsos}
            onSelecionarServico={onAbrirAgendamentoSemPlano}
            emptyText="Nenhum servico ativo disponivel."
          />
        ) : (
          <AlertBox type="warn" icon="calendarOff">
            A barbearia pausou novos agendamentos online agora. Para cortar, va direto ate a barbearia; planos continuam disponiveis.
          </AlertBox>
        )}

        {temPlanos && (
          <button onClick={onAbrirPlanos} className="btn primary">
            Ver planos mensais
          </button>
        )}
      </div>
    </div>
  );
}

function Recorrente({
  dados,
  temPlanos,
  historicoCompleto,
  servicosFeitos,
  ultimoServico,
  proximoAgendamento,
  agendamentoAtivo,
  prazoCancelamentoMinutos,
  onAbrirPlanos,
  onAbrirAgendamentoSemPlano,
  onVerAgendamento,
  onCancelarAgendamento,
}) {
  const ultimo = ultimoServico;
  const temAgendamentoAtivo = Boolean(proximoAgendamento);

  return (
    <div className="page on">
      <div className="scroll">
        <HeroCard
          dados={dados}
          sub={`Cliente desde ${dados.clienteDesde || 'maio 2026'}`}
          status={{ icon: 'x', label: 'Sem plano ativo', variant: 'none' }}
        />

        <PlanoCallout temPlanos={temPlanos} onAbrirPlanos={onAbrirPlanos} />

        <div className="border-t border-[#252525] pt-4">
          <p className="text-[#d5b451] text-[10px] font-black uppercase tracking-[0.22em] mb-2">
            {proximoAgendamento ? 'Proximo agendamento' : agendamentoAtivo ? 'Sem agendamento ativo' : 'Agendamento online pausado'}
          </p>
          <p className="text-white text-xl font-black">
            {proximoAgendamento ? formatarDataAgendamento(proximoAgendamento.data_hora) : agendamentoAtivo ? 'Pronto para agendar' : 'Atendimento direto na barbearia'}
          </p>
          <p className="text-[#d8d3c8] text-xs mt-2 leading-relaxed">
            {proximoAgendamento
              ? detalheAgendamento(proximoAgendamento)
              : agendamentoAtivo
              ? 'O cliente pode ter apenas um agendamento ativo por vez.'
              : 'No momento os agendamentos pelo site estao desativados. Para cortar, va diretamente ate a barbearia e aguarde o atendimento presencial.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#252525] pt-4">
          <InfoCard label="Servicos feitos" title={servicosFeitos ?? historicoCompleto.length} subtitle="historico avulso" />
          <InfoCard label="Status" title="Sem plano ativo" tone="muted" />
        </div>

        <div className={`grid gap-3 ${temAgendamentoAtivo || temPlanos ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {temAgendamentoAtivo ? (
            <>
              <ActionCard
                icon="clock"
                title="Ver agendamento"
                subtitle="codigo, local e acoes"
                onClick={() => onVerAgendamento?.(proximoAgendamento)}
                compact
              />
              <ActionCard
                icon="x"
                title="Cancelar"
                subtitle={`ate ${prazoCancelamentoMinutos} min antes`}
                onClick={() => onCancelarAgendamento?.(proximoAgendamento)}
                compact
              />
            </>
          ) : (
            <ActionCard
              icon={agendamentoAtivo ? 'scissors' : 'calendarOff'}
              title={agendamentoAtivo ? 'Escolher servico' : 'Agendamento pausado'}
              subtitle={agendamentoAtivo ? 'corte, barba ou combo' : 'novos horarios indisponiveis'}
              onClick={onAbrirAgendamentoSemPlano}
              disabled={!agendamentoAtivo}
            />
          )}
          {temPlanos && !temAgendamentoAtivo && (
            <ActionCard
              icon="crown"
              title="Ver planos"
              subtitle="economia para recorrencia"
              onClick={onAbrirPlanos}
            />
          )}
        </div>

        <div className="border-t border-[#252525] pt-4">
          <SectionTitle>Ultimo servico</SectionTitle>
          {ultimo ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[10px] bg-[#2c281b] text-[#d5b451] flex items-center justify-center flex-shrink-0">
                  <Icon name="scissors" className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-black truncate">{ultimo.nome || ultimo.tipo_corte || 'Servico'}</p>
                  <p className="text-zinc-500 text-[11px] mt-1">
                    {dataValida(ultimo.data || ultimo.created_at)?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) || 'Sem data'} - {ultimo.status || 'Finalizado'}
                  </p>
                </div>
              </div>
              {ultimo.preco && (
                <span className="text-[#d5b451] text-sm font-black">{formatarMoeda(ultimo.preco)}</span>
              )}
            </div>
          ) : (
            <div className="p-5 text-center border border-dashed border-[#333] rounded-[12px]">
              <p className="text-zinc-600 text-xs italic">Nenhum servico finalizado ainda.</p>
            </div>
          )}
        </div>

        {!agendamentoAtivo && (
          <div className="alert warn">
            <Icon name="calendarOff" className="w-5 h-5 flex-shrink-0" />
            <div className="alert-txt">A barbearia pausou novos agendamentos online. Para cortar, va direto ate a barbearia.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClienteDashboardAvulso({
  primeiroUso,
  dados,
  servicosAvulsos,
  temPlanos = false,
  historicoCompleto = [],
  servicosFeitos = 0,
  ultimoServico = null,
  proximoAgendamento = null,
  prazoCancelamentoMinutos = 120,
  agendamentoAtivo = false,
  onAbrirPlanos,
  onAbrirAgendamentoSemPlano,
  onVerAgendamento,
  onCancelarAgendamento,
}) {
  if (primeiroUso) {
    return (
      <PrimeiroUso
        dados={dados}
        servicosAvulsos={servicosAvulsos}
        temPlanos={temPlanos}
        agendamentoAtivo={agendamentoAtivo}
        onAbrirPlanos={onAbrirPlanos}
        onAbrirAgendamentoSemPlano={onAbrirAgendamentoSemPlano}
      />
    );
  }

  return (
    <Recorrente
      dados={dados}
      temPlanos={temPlanos}
      historicoCompleto={historicoCompleto}
      servicosFeitos={servicosFeitos}
      ultimoServico={ultimoServico}
      proximoAgendamento={proximoAgendamento}
      prazoCancelamentoMinutos={prazoCancelamentoMinutos}
      agendamentoAtivo={agendamentoAtivo}
      onAbrirPlanos={onAbrirPlanos}
      onAbrirAgendamentoSemPlano={onAbrirAgendamentoSemPlano}
      onVerAgendamento={onVerAgendamento}
      onCancelarAgendamento={onCancelarAgendamento}
    />
  );
}
