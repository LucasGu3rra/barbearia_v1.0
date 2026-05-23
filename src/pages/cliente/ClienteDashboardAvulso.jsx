import { HeroCard, AlertBox, SectionTitle } from './ClienteDashboardParts';
import ClienteServicoSelector from './ClienteServicoSelector';
import { parseDataSupabase } from './clienteDashboardUtils';

export default function ClienteDashboardAvulso({
  dados,
  servicosAvulsos,
  agendamentos,
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

        <AlertBox icon="crown">
          <strong>Assine um plano</strong> e economize em cada corte. Ver planos disponiveis.
        </AlertBox>

        <h2 className="text-white text-lg font-black mb-1">Escolha seu servico</h2>

        <ClienteServicoSelector
          servicos={servicosAvulsos}
          onSelecionarServico={onAbrirAgendamentoSemPlano}
          emptyText="Nenhum servico ativo disponivel."
        />

        <button onClick={onAbrirPlanos} className="btn primary">
          Ver planos mensais
        </button>

        {agendamentos.length > 0 && (
          <>
            <SectionTitle>Meus agendamentos</SectionTitle>
            <div className="space-y-2">
              {agendamentos.map((agendamento, index) => {
                const dataAgendamento = agendamento.data_hora ? parseDataSupabase(agendamento.data_hora) : null;

                return (
                  <div key={agendamento.id || index} className="bg-[#1b1b1b] border border-[#333] rounded-[10px] p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{agendamento.servicos?.nome || 'Servico'}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {dataAgendamento
                          ? `${dataAgendamento.toLocaleDateString('pt-BR')} as ${dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Sem data'}
                        {agendamento.barbeiros?.nome ? ` - ${agendamento.barbeiros.nome}` : ''}
                      </p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#d5b451]">{agendamento.status}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
