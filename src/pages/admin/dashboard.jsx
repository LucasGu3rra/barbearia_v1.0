import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import BottomNav from '../../components/BottomNav'

export default function Dashboard() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [stats, setStats] = useState({ hoje: 0, ativos: 0, vencidos: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('admin')
    if (!stored) { navigate('/admin'); return }
    const a = JSON.parse(stored)
    setAdmin(a)
    loadData(a.id)

    // Atualiza em tempo real quando cliente faz check-in
    const channel = supabase
      .channel('checkins-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'checkins'
      }, () => loadData(a.id))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const loadData = async (adminId) => {
    const today = new Date().toISOString().split('T')[0]

    // Check-ins de hoje
    const { data: checkinsData } = await supabase
      .from('checkins')
      .select('*, clients(name, last_name), subscriptions(plan_name)')
      .eq('admin_id', adminId)
      .eq('date', today)
      .order('checked_in_at', { ascending: false })

    setCheckins(checkinsData || [])

    // Contagem de assinantes ativos e vencidos
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('status, ends_at')
      .eq('admin_id', adminId)
      .eq('status', 'active')

    if (subs) {
      const now = new Date()
      const ativos = subs.filter(s => new Date(s.ends_at) >= now).length
      const vencidos = subs.filter(s => new Date(s.ends_at) < now).length
      setStats({ hoje: checkinsData?.length || 0, ativos, vencidos })
    }

    setLoading(false)
  }

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return (
      <div className="screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-lg font-semibold text-gray-100">{admin?.barbershop_name}</h1>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem('admin'); navigate('/admin') }}
          className="text-xs text-gray-600 border border-dark-500 rounded-lg px-3 py-1.5"
        >
          Sair
        </button>
      </div>

      <div className="flex-1 px-5 pb-2 overflow-y-auto animate-fade-in">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gold">{stats.hoje}</p>
            <p className="text-xs text-gray-500 mt-1">Hoje</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-400">{stats.ativos}</p>
            <p className="text-xs text-gray-500 mt-1">Ativos</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-400">{stats.vencidos}</p>
            <p className="text-xs text-gray-500 mt-1">Vencidos</p>
          </div>
        </div>

        {/* Título + indicador ao vivo */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-200">Check-ins de hoje</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400">Ao vivo</span>
          </div>
        </div>

        {/* Lista */}
        {checkins.length === 0 ? (
          <div className="card flex flex-col items-center py-12 text-center">
            <p className="text-4xl mb-3">✂️</p>
            <p className="text-sm text-gray-400">Nenhum check-in ainda hoje</p>
            <p className="text-xs text-gray-600 mt-1">A lista atualiza automaticamente</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {checkins.map((c, i) => (
              <div
                key={c.id}
                className="card flex items-center justify-between animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-green-400">
                      {c.clients?.name?.[0]}{c.clients?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-100">
                      {c.clients?.name} {c.clients?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{c.subscriptions?.plan_name}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-xs text-gray-500">{formatTime(c.checked_in_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}