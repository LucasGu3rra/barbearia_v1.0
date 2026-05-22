import { HeroCard, AlertBox, SectionTitle, Icon } from './ClienteDashboardParts';
import { formatarMoeda } from './clienteDashboardUtils';

export default function ClienteDashboardPendente({
  dados,
  onEnviarComprovante,
  onTrocarPlano,
  onVerChavePix,
  onAgendarAvulso,
  pagamentoIniciado,
  agendamentos = [],
}) {
  return (
    <div className="page on">
      <div className="scroll">
        <HeroCard
          dados={dados}
          sub={dados.whatsapp}
          status={{ icon: 'clock', label: 'Plano pendente', variant: 'pending' }}
        />

        <AlertBox icon="clock">
          <strong>Aguardando confirmacao.</strong> {pagamentoIniciado ? 'Seu pagamento foi encaminhado pelo WhatsApp. Agora aguarde a confirmacao da barbearia.' : 'Envie o comprovante Pix para o WhatsApp da barbearia. Seu plano ativa em ate 24h.'}
        </AlertBox>

        <div className="card">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Plano escolhido</p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-white font-bold">Plano {dados.planoNome}</p>
              <p className="text-xs text-zinc-500 mt-1">{dados.limiteTotal} cortes/mes - {formatarMoeda(dados.precoPlano)}/mes</p>
            </div>
            <span className="bg-[#2b2619] text-[#d5b451] text-[10px] px-3 py-1 rounded-full">Aguardando</span>
          </div>
        </div>

        {!pagamentoIniciado && (
          <>
            <button onClick={onEnviarComprovante} className="btn primary flex items-center justify-center gap-2">
              <Icon name="whatsapp" className="w-4 h-4" />
              Enviar comprovante no WhatsApp
            </button>
            <button onClick={onTrocarPlano} className="btn secondary">Trocar plano</button>
            <button onClick={onVerChavePix} className="btn ghost">Ver chave Pix</button>
          </>
        )}

        <SectionTitle>Enquanto isso</SectionTitle>
        <button onClick={onAgendarAvulso} className="sopt">
          <div className="sopt-ico">
            <Icon name="calendar" className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="sopt-name">Agendar avulso</p>
            <p className="sopt-sub">Servico sem usar o plano</p>
          </div>
          <Icon name="chevron" className="w-4 h-4 text-zinc-600 ml-auto" />
        </button>

        {agendamentos.length > 0 && (
          <>
            <SectionTitle>Agendamentos avulsos</SectionTitle>
            <div className="space-y-2">
              {agendamentos.map((agendamento, index) => {
                const dataAgendamento = agendamento.data_hora ? new Date(agendamento.data_hora) : null;

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
