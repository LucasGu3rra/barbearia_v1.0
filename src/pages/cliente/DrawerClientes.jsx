import React, { useState } from 'react';

// Função para exibir apenas Nome + Sobrenome e adicionar os 3 pontinhos (...)
const formatarNomeVisivel = (nomeCompleto) => {
  if (!nomeCompleto) return '';
  const partes = nomeCompleto.trim().split(/\s+/);
  
  // Se tem só 1 ou 2 palavras, retorna elas. Se tiver mais, pega as duas primeiras e põe ...
  if (partes.length <= 2) {
    return partes.join(' ');
  }
  return `${partes[0]} ${partes[1]}...`;
};

export default function DrawerClientes({
  isOpen,
  onClose,
  dados,
  editandoNome,
  setEditandoNome,
  novoNome,
  setNovoNome,
  salvarNovoNome,
  LIMITE_ALTERACOES,
  planosDb,
  alterarPlano,
  cancelarAgendamento,
  onLogout
}) {
  const [planosAbertos, setPlanosAbertos] = useState(false);

  if (!dados) return null;

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
      
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      ></div>

      {/* Conteúdo do Drawer */}
      <div className={`absolute right-0 top-0 bottom-0 w-4/5 max-w-[320px] bg-[#0c0c0e] border-l border-[#27272a] p-6 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-bold text-white">Minha Conta</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {/* Seção de Perfil */}
        <div className="mb-8">
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Nome do Cliente</p>
              {!editandoNome && dados.alteracoesNome < LIMITE_ALTERACOES && (
                <button 
                  onClick={() => {
                    setEditandoNome(true); 
                    setNovoNome(dados.nome);
                  }} 
                  className="text-[#CEAA6B] text-[10px] font-bold uppercase hover:text-white transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
            
            {editandoNome ? (
              <div className="bg-[#121212] border border-[#27272a] rounded-xl p-3 mt-1 animate-[fadeIn_0.2s_ease-in-out]">
                <p className="text-[9px] text-orange-500 font-bold uppercase tracking-widest text-center mb-3">
                  Aviso: Restam {LIMITE_ALTERACOES - dados.alteracoesNome} alterações
                </p>
                <div className="flex gap-2">
                  <input 
                    autoFocus 
                    value={novoNome} 
                    onChange={e => setNovoNome(e.target.value)} 
                    placeholder="Digite seu nome completo"
                    className="flex-1 w-full bg-[#09090b] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#CEAA6B]/50 transition-colors" 
                  />
                  <button 
                    onClick={salvarNovoNome} 
                    className="bg-[#CEAA6B] text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#b08d55] transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-medium text-white text-base truncate max-w-[200px]" title={dados.nome}>
                {formatarNomeVisivel(dados.nome)}
              </p>
            )}
          </div>
          
          <div className="mb-5">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">WhatsApp</p>
            <p className="font-medium text-white">{dados.whatsapp}</p>
          </div>
          
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Status da Assinatura</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${dados.status === 'ativa' ? 'bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]'}`}></div>
              <span className={`text-xs font-bold uppercase tracking-wide ${dados.status === 'ativa' ? 'text-[#22c55e]' : 'text-orange-500'}`}>
                {dados.status === 'ativa' ? 'Ativa' : 'Pendente'}
              </span>
            </div>
          </div>
        </div>

        {/* Agrupamento: Serviços (Agendamento + Troca de Plano) */}
        <div className="flex flex-col mb-auto overflow-y-auto pr-1">
          <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Serviços</h3>
          
          <div className="space-y-3">
            {/* Botão de Agendamento */}
            <button 
              disabled
              className="w-full p-4 rounded-xl border border-[#27272a] bg-[#121212]/40 flex justify-between items-center opacity-80 cursor-not-allowed"
            >
              <span className="text-zinc-400 font-bold text-sm">Agendamento</span>
              <span className="text-[8px] bg-[#27272a] text-zinc-400 px-2 py-1 rounded font-bold uppercase tracking-widest">
                Em breve
              </span>
            </button>

            {/* Troca de Plano (Accordion estilo Menu) */}
            <div className="bg-[#121212] border border-[#27272a] rounded-xl overflow-hidden">
              <button 
                onClick={() => setPlanosAbertos(!planosAbertos)}
                className="w-full p-4 flex justify-between items-center transition-colors hover:bg-[#1a1a1e]"
              >
                <span className="font-bold text-sm text-white">Trocar Meu Plano</span>
                <svg 
                  className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${planosAbertos ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Só mostra os planos se a setinha estiver aberta */}
              {planosAbertos && (
                <div className="p-3 pt-0 border-t border-[#27272a]/50 bg-[#121212]">
                  <div className="space-y-2 mt-3">
                    {planosDb.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => alterarPlano(p.slug)} 
                        className={`w-full p-3 rounded-xl border text-left flex justify-between items-center transition-all ${dados.planoId === p.slug ? 'border-[#CEAA6B] bg-[#1a120b]' : 'border-[#27272a] bg-[#0c0c0e] hover:border-[#CEAA6B]/30'}`}
                      >
                        <div>
                          <p className={`font-bold text-sm ${dados.planoId === p.slug ? 'text-[#CEAA6B]' : 'text-white'}`}>{p.nome}</p>
                          <p className="text-[10px] text-zinc-500">R$ {p.preco}/mês</p>
                        </div>
                        {dados.planoId === p.slug ? (
                          <span className="bg-[#CEAA6B] text-black text-[9px] font-black px-2 py-1 rounded">ATUAL</span>
                        ) : (
                          dados.proximoPlano === p.slug && (
                            <span className="text-[8px] text-[#CEAA6B] font-bold uppercase border border-[#CEAA6B]/30 px-2 py-1 rounded">
                              Agendado
                            </span>
                          )
                        )}
                      </button>
                    ))}
                    
                    {dados.proximoPlano && (
                      <button 
                        onClick={cancelarAgendamento} 
                        className="w-full mt-2 text-zinc-500 text-[10px] font-bold uppercase py-3 hover:text-white transition-colors text-center border border-zinc-800 rounded-xl"
                      >
                        Cancelar Agendamento
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botão de Sair */}
        <button 
          onClick={onLogout} 
          className="mt-8 py-4 text-red-500 text-xs font-bold uppercase tracking-widest border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors"
        >
          Sair da Conta
        </button>
      </div>
      
      {/* Pequeno CSS embutido para a animação do campo de edição */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}} />
    </div>
  );
}