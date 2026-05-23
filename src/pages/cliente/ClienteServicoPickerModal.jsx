import { Icon } from './ClienteDashboardParts';
import ClienteAgendamentoStepBar from './ClienteAgendamentoStepBar';
import ClienteServicoSelector from './ClienteServicoSelector';

export default function ClienteServicoPickerModal({ isOpen, onClose, servicos = [], onSelecionarServico }) {
  if (!isOpen) return null;

  const selecionar = (servicoId) => {
    onSelecionarServico(servicoId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
      <div className="w-full max-w-[390px] h-[88vh] max-h-[780px] min-h-[560px] bg-[#050505] border border-[#242424] rounded-[28px] overflow-hidden flex flex-col shadow-2xl">
        <div className="back-bar flex-shrink-0">
          <button className="back-btn" onClick={onClose}>
            <Icon name="chevron" className="w-4 h-4 rotate-180" />
          </button>
          <span className="back-title">Escolher servico</span>
        </div>

        <div className="flex-1 min-h-0 p-4 pt-3 flex flex-col">
          <div className="mb-4">
            <ClienteAgendamentoStepBar step={1} />
          </div>
          <ClienteServicoSelector
            servicos={servicos}
            onSelecionarServico={selecionar}
            emptyText="Nenhum servico ativo disponivel."
            scrollable
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
