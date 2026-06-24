import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api'
import { Bot, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      toast.success('Welcome back! 🚀')
      navigate('/dashboard')
    },
    onError: () => {
      toast.error('Invalid credentials. Please try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Please fill in all fields'); return }
    loginMutation.mutate()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%', top: '-100px', left: '-100px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: '400px', height: '400px',
        borderRadius: '50%', bottom: '-50px', right: '-50px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '40px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 30px rgba(99,102,241,0.4)',
          }}>
            <Bot size={28} color="white" />
          </div>
          <h1 style={{
            fontSize: '24px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px',
          }}>
            AI Hiring Platform
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Enterprise Recruitment Automation
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#4a5568' }} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="recruiter@company.com"
                style={{
                  width: '100%', padding: '12px 14px 12px 42px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', color: '#e2e8f0', fontSize: '14px',
                  outline: 'none', transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#4a5568' }} />
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 42px 12px 42px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', color: '#e2e8f0', fontSize: '14px',
                  outline: 'none', transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: '100%', padding: '13px',
              background: loginMutation.isPending
                ? 'rgba(99,102,241,0.5)'
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border: 'none', borderRadius: '10px',
              color: 'white', fontSize: '15px', fontWeight: 600,
              cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'opacity 0.2s',
              boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
            }}
          >
            {loginMutation.isPending ? (
              <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
            ) : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '24px', padding: '16px',
          background: 'rgba(99,102,241,0.08)', borderRadius: '10px',
          border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginBottom: '8px', fontWeight: 600 }}>
            Demo Credentials
          </p>
          <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
            admin@hiring.com / admin123
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
