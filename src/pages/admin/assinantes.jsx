import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import BottomNav from '../../components/BottomNav'

export default function Assinantes() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('admin')
    if (!stored) { navigate('/admin'); return }
    const a = JSON.parse(stored)
    setAdmin(a)
    loadClients(a.id)
  }, [])

  const loadClients = async (adminId) => {
    const { data } = await supabase
      .from('clients')
      .select('*, subscriptions(id, plan_name, plan_price, cuts_used, max_cuts, ends_at, status)')
      .eq('admin_id', adminId)
      .order('name')

    const today = new Date()

    const enriched = (data || []).map(client => {
      const activeSub = (client.subscriptions || [])
        .filter(s => s.status === 'active')
        .sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))[0]

      let clientStatus = 'sem_plano'
      if (activeSub) {
        clientStatus = new Date(activeSub.ends_at) >= today ? 'ativo' : 'vencido'
      }

      return { ...client, activeSub, clientStatus }
    })

    setClients(enriched)
    setLoading(false)
  }

  const filtered = clients.filter(c => {
    const matchSearch = `${c.name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'todos' || c.clientStatus === filter
    return matchSearch && matchFilter
  })

  const statusConfig = {
    ativo:     { label: 'Ativo',     color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    vencido:   { label: 'Vencido',   color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/30' },
    sem_plano: { label: 'Sem plano', color: 'text-gray-500',  bg: 'bg-dark-600 border-dark-500' },
  }

  const daysLeft = (endsAt) =>
    Math.ceil((new Date(endsAt) - new Date()) / (1000 * 60 * 60 * 24))

  if (loading) {
    return (
      <div className="screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-lg font-semibold text-gray-100 mb-4">Clientes</h1>

        {/* Busca */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#555" strokeWidth="1.5"/>
            <path d="M16.5 16.5L21 21" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="input-field pl-9"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'todos',     label: `Todos (${clients.length})` },
            { key: 'ativo',     label: 'Ativos' },
            { key: 'vencido',   label: 'Vencidos' },
            { key: 'sem_plano', label: 'Sem plano' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-medium border transition-all
                ${filter === f.key
                  ? 'bg-gold text-dark-800 border-gold'
                  : 'bg-dark-700 text-gray-500 border-dark-500'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 pb-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-500 text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(client => {
              const sc = statusConfig[client.clientStatus]
              return (
                <div
                  key={client.id}
                  className="card cursor-pointer active:scale-[0.98] transition-all"
                  onClick={() => navigate(`/admin/registrar-pagamento/${client.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${sc.bg}`}>
                        <span className={`text-xs font-bold ${sc.color}`}>
                          {client.name[0]}{client.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-100">
                          {client.name} {client.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {client.activeSub ? client.activeSub.plan_name : 'Sem assinatura ativa'}
                        </p>
                      </div>
                    </div>
                    <div className={`border rounded-lg px-2.5 py-1 ${sc.bg}`}>
                      <span className={`text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                    </div>
                  </div>

                  {client.activeSub && (
                    <div className="flex items-center justify-between pt-2 border-t border-dark-500">
                      <span className="text-xs text-gray-500">
                        ✂️ {client.activeSub.cuts_used}/{client.activeSub.max_cuts} cortes
                      </span>
                      <span className="text-xs text-gray-500">
                        {client.clientStatus === 'ativo'
                          ? `Vence em ${daysLeft(client.activeSub.ends_at)}d`
                          : `Venceu ${new Date(client.activeSub.ends_at).toLocaleDateString('pt-BR')}`}
                      </span>
                      <span className="text-xs text-gold font-medium">
                        R$ {client.activeSub.plan_price}/mês
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}