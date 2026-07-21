import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api'
import { Bot, Mail, Lock, Eye, EyeOff, Loader2, Building, User } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      queryClient.clear()
      toast.success('Welcome back!')
      navigate('/dashboard')
    },
    onError: () => {
      toast.error('Invalid credentials. Please try again.')
    },
  })

  const registerMutation = useMutation({
    mutationFn: () => authApi.register({
      email,
      password,
      full_name: companyName || 'Company Recruiter',
      company_name: companyName || 'TechCorp Inc.',
      role: 'recruiter',
    }),
    onSuccess: () => {
      toast.success('Company registered! Signing in...')
      loginMutation.mutate()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Registration failed. Please try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in email and password')
      return
    }
    if (isRegister) {
      if (!companyName) {
        toast.error('Please fill in your company name')
        return
      }
      registerMutation.mutate()
    } else {
      loginMutation.mutate()
    }
  }

  const isPending = loginMutation.isPending || registerMutation.isPending

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#111111',
        border: '1px solid #1e1e1e',
        borderRadius: '14px',
        padding: '36px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '12px',
            background: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <Bot size={26} color="#0a0a0a" />
          </div>
          <h1 style={{
            fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '4px',
          }}>
            AI Hiring Platform
          </h1>
          <p style={{ color: '#555555', fontSize: '13px' }}>
            Enterprise Recruitment Automation
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex', background: '#1a1a1a', padding: '4px',
          borderRadius: '10px', marginBottom: '24px', border: '1px solid #2a2a2a',
        }}>
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            style={{
              flex: 1, padding: '9px', borderRadius: '7px', border: 'none',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              background: !isRegister ? '#262626' : 'transparent',
              color: !isRegister ? '#ffffff' : '#666666',
              transition: 'all 0.2s',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            style={{
              flex: 1, padding: '9px', borderRadius: '7px', border: 'none',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              background: isRegister ? '#262626' : 'transparent',
              color: isRegister ? '#ffffff' : '#666666',
              transition: 'all 0.2s',
            }}
          >
            Register Company
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              {/* Company Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#888888', marginBottom: '7px' }}>
                  Company Name
                </label>
                <div style={{ position: 'relative' }}>
                  <Building size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#444444' }} />
                  <input
                    id="company_name"
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Acme Corp Inc."
                    style={{
                      width: '100%', padding: '11px 13px 11px 38px',
                      background: '#1a1a1a', border: '1px solid #2a2a2a',
                      borderRadius: '8px', color: '#e8e8e8', fontSize: '14px',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#888888', marginBottom: '7px' }}>
              Work Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#444444' }} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="recruiter@company.com"
                style={{
                  width: '100%', padding: '11px 13px 11px 38px',
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: '8px', color: '#e8e8e8', fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#888888', marginBottom: '7px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#444444' }} />
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '11px 40px 11px 38px',
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: '8px', color: '#e8e8e8', fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#555555', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={isPending}
            style={{
              width: '100%', padding: '12px',
              background: isPending ? '#333333' : '#ffffff',
              border: 'none', borderRadius: '8px',
              color: isPending ? '#888888' : '#0a0a0a',
              fontSize: '14px', fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {isPending ? (
              <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> {isRegister ? 'Registering Company...' : 'Signing in...'}</>
            ) : (isRegister ? 'Register & Access Chatbot' : 'Sign In')}
          </button>
        </form>

        <div style={{
          marginTop: '20px', padding: '14px',
          background: '#1a1a1a', borderRadius: '8px',
          border: '1px solid #2a2a2a',
        }}>
          <p style={{ fontSize: '11px', color: '#555555', textAlign: 'center', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Demo Credentials
          </p>
          <p style={{ fontSize: '13px', color: '#888888', textAlign: 'center' }}>
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
