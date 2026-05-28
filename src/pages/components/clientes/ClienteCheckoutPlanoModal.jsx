import { Icon } from './ClienteDashboardParts';

export default function ClienteCheckoutPlanoModal({
  isOpen,
  dados,
  mapaPlanos,
  chavePix,
  pixCopiado,
  onClose,
  onCopiarPix,
  onAbrirWhatsappPagamento,
}) {
  if (!isOpen || !dados) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-0">
      <div className="client-device rounded-t-[28px] sm:rounded-[28px] min-h-0 max-h-[92vh] overflow-y-auto">
        <div className="back-bar">
          <button className="back-btn" onClick={onClose}>
            <Icon name="chevron" className="w-4 h-4 rotate-180" />
          </button>
          <span className="back-title">Pagamento</span>
        </div>

        <div className="scroll" style={{ paddingTop: 12 }}>
          <div className="card">
            <div className="stat-lbl">PLANO SELECIONADO</div>
            <div className="flex items-center justify-between mt-2 gap-3">
              <div className="text-white text-sm font-semibold">
                {dados.valorUpgrade ? `Upgrade para ${mapaPlanos[dados.planoUpgradeId]?.nome}` : `Plano ${dados.planoNome}`}
              </div>
              <div className="text-[#d5b451] text-[22px] font-black">
                R${dados.valorUpgrade || dados.precoPlano}
              </div>
            </div>
          </div>

          <div className="pix-box">
            <div className="pix-title">
              <div className="pix-title-ico">
                <Icon name="money" className="w-4 h-4" />
              </div>
              <div className="text-white text-sm font-semibold">Pagar via Pix</div>
            </div>

            <div className="pix-key">
              <span>{chavePix}</span>
              <button type="button" className="pix-copy" onClick={onCopiarPix}>
                <Icon name="copy" className="w-3 h-3" />
                {pixCopiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <ul className="pix-steps">
              <li><div className="pix-n">1</div>Copie a chave Pix acima</li>
              <li><div className="pix-n">2</div>Abra seu banco e faca a transferencia</li>
              <li><div className="pix-n">3</div>Tire print do comprovante</li>
              <li><div className="pix-n">4</div>Envie pelo botao abaixo no WhatsApp</li>
            </ul>
          </div>

          <button className="btn primary flex items-center justify-center gap-2" onClick={onAbrirWhatsappPagamento}>
            <Icon name="whatsapp" className="w-4 h-4" />
            Enviar comprovante no WhatsApp
          </button>

          <div className="alert warn">
            <Icon name="info" className="w-5 h-5 flex-shrink-0" />
            <div className="alert-txt">
              Seu plano sera ativado em ate <strong>24h</strong> apos a confirmacao do pagamento pelo barbeiro.
            </div>
          </div>

          <div className="sec">OUTRAS FORMAS</div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Icon name="store" className="w-5 h-5 text-zinc-500" />
              <div>
                <div className="text-[#d8d3c8] text-sm font-semibold">Cartao ou dinheiro</div>
                <div className="text-zinc-500 text-xs mt-0.5">Pagamento presencial na barbearia</div>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn ghost">Fazer depois</button>
        </div>
      </div>
    </div>
  );
}
