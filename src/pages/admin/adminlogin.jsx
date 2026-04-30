import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('Preencha todos os campos'); return }
    setLoading(true)
    setError('')

    try {
      const { data, error: err } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('password_hash', password)
        .single()

      if (err || !data) {
        setError('E-mail ou senha incorretos')
        setLoading(false)
        return
      }

      if (!data.active) {
        setError('Acesso suspenso. Entre em contato com o suporte.')
        setLoading(false)
        return
      }

      sessionStorage.setItem('admin', JSON.stringify(data))
      navigate('/admin/dashboard')
    } catch (e) {
      setError('Erro ao conectar. Tente novamente.')
    }
    setLoading(false)
  }

  return (
    <div className="screen">
      <div className="flex-1 flex flex-col justify-center px-6 animate-fade-in">

        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-dark-600 rounded-2xl border border-dark-500 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 1l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" stroke="#c9a96e" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-100">Painel do Barbeiro</h1>
          <p className="text-sm text-gray-500 mt-1">Acesso exclusivo</p>
        </div>

        <div className="card mb-4">
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">E-mail</label>
            <input
              className="input-field"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Senha</label>
            <input
              className="input-field"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button className="btn-gold" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <div className="w-5 h-5 border-2 border-dark-800 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>Entrar no painel</span>
          )}
        </button>

        <button onClick={() => navigate('/')} className="mt-4 text-sm text-gray-600 text-center underline underline-offset-2">
          Área do cliente
        </button>
      </div>
    </div>
  )
}