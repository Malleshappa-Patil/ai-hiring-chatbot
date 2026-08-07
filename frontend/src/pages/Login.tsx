import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Editorial colour tokens ──────────────────────────────────── */
const C = {
  bg:        '#181818',
  text:      '#EBDCC4',
  muted:     '#B6A596',
  faint:     '#7A6A5E',
  accent:    '#DC9F85',
  border:    '#66473B',
  divider:   '#35211A',
  input:     'rgba(235,220,196,0.04)',
}

/* ── Inline styles helper ────────────────────────────────────── */
const field: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: '4px',
  color: C.text,
  fontSize: '14px',
  fontFamily: "'General Sans', 'Inter', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}

export default function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      queryClient.clear()
      toast.success('Welcome back.')
      navigate('/dashboard')
    },
    onError: () => toast.error('Invalid credentials.'),
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
      toast.success('Company registered.')
      loginMutation.mutate()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Registration failed.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Enter email and password.'); return }
    if (isRegister) {
      if (!companyName) { toast.error('Enter company name.'); return }
      registerMutation.mutate()
    } else {
      loginMutation.mutate()
    }
  }

  const isPending = loginMutation.isPending || registerMutation.isPending

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'General Sans', 'Inter', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Noise overlay ──────────────────────────────────────── */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', opacity: 0.03, pointerEvents: 'none', zIndex: 0 }}>
        <filter id="noise-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise-filter)" />
      </svg>

      {/* ── Minimal Navigation ────────────────────────────────── */}
      <nav style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        padding: '20px 36px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        zIndex: 10,
      }}>
        {/* Left: Brand ID */}
        <span style={{
          fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
          fontSize: '11px',
          fontWeight: 700,
          color: C.muted,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          AI—HIRING 01
        </span>

        {/* Center: 1px line spacer */}
        <div style={{ flex: 1, height: '1px', background: C.divider }} />

        {/* Right: Status label */}
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: C.divider,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          INVITE ONLY
        </span>
      </nav>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>

        {/* ── Hero Headline Section ─────────────────────────── */}
        <div style={{
          padding: '120px 36px 48px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {/* Early Access label */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}>
            <div style={{ width: '24px', height: '1px', background: C.accent, flexShrink: 0 }} />
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: C.muted,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}>
              Early Access — Platform
            </span>
          </div>

          {/* Oversized headline with depth layering */}
          <div style={{ position: 'relative', marginBottom: '48px', lineHeight: 0.85 }}>
            {/* Layer 1 (Back) — outline text offset */}
            <div style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
              fontSize: 'clamp(56px, 11.5vw, 160px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 0.85,
              textTransform: 'uppercase',
              WebkitTextStroke: `1px ${C.border}`,
              color: 'transparent',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}>
              AI HIRING
            </div>
            {/* Layer 2 (Front) — solid text */}
            <div style={{
              fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
              fontSize: 'clamp(56px, 11.5vw, 160px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 0.85,
              textTransform: 'uppercase',
              color: C.text,
              position: 'relative',
              zIndex: 1,
              whiteSpace: 'nowrap',
            }}>
              AI HIRING
            </div>
          </div>

          {/* ── Bottom Grid: Statement + Form ─────────────────── */}
          <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: '36px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '24px',
              alignItems: 'start',
            }}>

              {/* Cols 1–5: Exclusivity statement */}
              <div style={{ gridColumn: '1 / 6' }}>
                <p style={{
                  fontSize: '18px',
                  fontWeight: 300,
                  color: C.text,
                  lineHeight: 1.65,
                  marginBottom: '20px',
                  letterSpacing: '0.01em',
                }}>
                  Enterprise-grade AI recruitment automation. Intelligent agents that source,
                  screen, and schedule — so your team focuses on what matters.
                </p>

                {/* Status indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    background: C.accent,
                    animation: 'pulse-dot 2s ease-in-out infinite',
                  }} />
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: C.muted,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}>
                    Batch 003 Filling
                  </span>
                </div>
              </div>

              {/* Spacer col 6 */}
              <div style={{ gridColumn: '6 / 7' }} />

              {/* Cols 7–12: Auth form */}
              <div style={{ gridColumn: '7 / 13' }}>

                {/* Tab switcher */}
                <div style={{
                  display: 'flex',
                  borderBottom: `1px solid ${C.divider}`,
                  marginBottom: '24px',
                  gap: '0',
                }}>
                  {(['Sign In', 'Register'] as const).map(tab => {
                    const active = tab === 'Sign In' ? !isRegister : isRegister
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setIsRegister(tab === 'Register')}
                        style={{
                          padding: '8px 18px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                          color: active ? C.text : C.faint,
                          fontSize: '12px',
                          fontWeight: active ? 700 : 400,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontFamily: "'General Sans', 'Inter', sans-serif",
                          transition: 'all 0.15s ease',
                          marginBottom: '-1px',
                        }}
                      >
                        {tab}
                      </button>
                    )
                  })}
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Company name (register only) */}
                  {isRegister && (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '9px',
                        fontWeight: 700,
                        color: C.faint,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        marginBottom: '7px',
                      }}>Company Name</label>
                      <input
                        id="company_name"
                        type="text"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="Acme Corp Inc."
                        style={{ ...field }}
                        onFocus={e => e.currentTarget.style.borderColor = C.accent}
                        onBlur={e => e.currentTarget.style.borderColor = C.border}
                      />
                    </div>
                  )}

                  {/* Email */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: C.faint,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      marginBottom: '7px',
                    }}>Work Email</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="recruiter@company.com"
                      style={{ ...field }}
                      onFocus={e => e.currentTarget.style.borderColor = C.accent}
                      onBlur={e => e.currentTarget.style.borderColor = C.border}
                    />
                  </div>

                  {/* Password */}
                  <div style={{ marginBottom: '22px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: C.faint,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      marginBottom: '7px',
                    }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="password"
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ ...field, paddingRight: '42px' }}
                        onFocus={e => e.currentTarget.style.borderColor = C.accent}
                        onBlur={e => e.currentTarget.style.borderColor = C.border}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        style={{
                          position: 'absolute', right: '13px', top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none', border: 'none',
                          color: C.faint, cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit — unified form block style */}
                  <div style={{ display: 'flex', marginBottom: '10px' }}>
                    <button
                      id="login-submit-btn"
                      type="submit"
                      disabled={isPending}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: isPending ? C.divider : C.accent,
                        border: 'none',
                        borderRadius: '4px',
                        color: isPending ? C.faint : C.bg,
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        cursor: isPending ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                        fontFamily: "'General Sans', 'Inter', sans-serif",
                      }}
                    >
                      {isPending
                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />{isRegister ? 'Registering...' : 'Signing in...'}</>
                        : (isRegister ? 'Create Account' : 'Access Platform')
                      }
                    </button>
                  </div>

                  {/* Caption */}
                  <p style={{
                    fontSize: '10px',
                    color: C.divider,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}>
                    Zero spam. Pure utility.
                  </p>
                </form>

                {/* Demo credentials */}
                <div style={{
                  marginTop: '24px',
                  padding: '12px 14px',
                  background: 'rgba(235,220,196,0.03)',
                  border: `1px solid ${C.divider}`,
                  borderRadius: '4px',
                }}>
                  <p style={{
                    fontSize: '9px',
                    color: C.faint,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginBottom: '5px',
                  }}>
                    Demo Access
                  </p>
                  <p style={{ fontSize: '12px', color: C.muted, letterSpacing: '0.03em' }}>
                    admin@hiring.com &nbsp;/&nbsp; admin123
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer strip ─────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${C.divider}`,
          padding: '14px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 1,
        }}>
          <span style={{ fontSize: '10px', color: C.divider, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            © 2026 AI Hiring Platform
          </span>
          <span style={{ fontSize: '10px', color: C.divider, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Enterprise Recruitment Automation
          </span>
        </div>
      </div>

      {/* ── Rotating Waitlist Badge (bottom-right) ────────────── */}
      <div style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        width: '64px',
        height: '64px',
        zIndex: 100,
      }}>
        <svg
          viewBox="0 0 64 64"
          width="64"
          height="64"
          style={{ overflow: 'visible' }}
        >
          {/* Outer circle border */}
          <circle cx="32" cy="32" r="30" fill="none" stroke={C.divider} strokeWidth="1" />

          {/* Rotating text path */}
          <g style={{ animation: 'rotate-text 12s linear infinite', transformOrigin: '32px 32px' }}>
            <defs>
              <path id="badge-circle-path" d="M 32,32 m -22,0 a 22,22 0 1,1 44,0 a 22,22 0 1,1 -44,0" />
            </defs>
            <text fontSize="7" fontWeight="700" fontFamily="'General Sans','Inter',sans-serif" fill={C.divider} letterSpacing="2.5">
              <textPath href="#badge-circle-path">
                WAITING LIST • WAITING LIST •&nbsp;
              </textPath>
            </text>
          </g>
        </svg>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.4); }
        }
        @keyframes rotate-text {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .hero-headline { font-size: 16vw !important; }
        }
      `}</style>
    </div>
  )
}
