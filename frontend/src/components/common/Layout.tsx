import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  GitBranch,
  BarChart3,
  ClipboardCheck,
  LogOut,
  Bot,
  ChevronRight,
  Building,
  ShieldCheck,
  User as UserIcon,
  Menu,
} from 'lucide-react'
import AIChatbot from '@/components/chatbot/AIChatbot'

/* ── Colour tokens ────────────────────────────────────────────── */
const C = {
  bg:        '#181818',
  bgPanel:   '#1E1A18',
  bgHover:   '#231F1C',
  text:      '#EBDCC4',
  textMuted: '#B6A596',
  textFaint: '#7A6A5E',
  accent:    '#DC9F85',
  border:    '#66473B',
  divider:   '#35211A',
}

const RECRUITER_NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/jobs',       label: 'Job Management',     icon: Briefcase },
  { to: '/candidates', label: 'Candidates',         icon: Users },
  { to: '/workflow',   label: 'Workflow Monitor',   icon: GitBranch },
  { to: '/analytics',  label: 'Analytics',          icon: BarChart3 },
  { to: '/onboarding', label: 'Onboarding',         icon: ClipboardCheck },
]

const ADMIN_NAV_ITEMS = [
  { to: '/dashboard',  label: 'Companies Overview', icon: Building },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: user } = useQuery({
    queryKey: ['auth-me'],
    queryFn: authApi.me,
    staleTime: 5 * 60 * 1000,
  })

  const isAdmin = user?.role === 'admin'
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : RECRUITER_NAV_ITEMS

  const handleLogout = () => {
    localStorage.clear()
    queryClient.clear()
    navigate('/login')
  }

  const displayName = isAdmin
    ? (user?.full_name || 'Platform Admin')
    : (user?.company_name || user?.full_name || 'Company')

  const initials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'PA'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'General Sans', 'Inter', sans-serif" }}>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside style={{
        width: collapsed ? '64px' : '240px',
        minHeight: '100vh',
        background: C.bgPanel,
        borderRight: `1px solid ${C.divider}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s ease',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
        overflow: 'hidden',
      }}>

        {/* ── Brand / Logo ──────────────────────────────────── */}
        <div style={{
          padding: collapsed ? '16px 12px' : '18px 16px',
          borderBottom: `1px solid ${C.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: '60px',
          gap: '10px',
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              {/* Logo mark */}
              <div style={{
                width: 32, height: 32,
                border: `1px solid ${C.border}`,
                borderRadius: '4px',
                background: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bot size={16} color={C.bg} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{
                  fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: '13px',
                  color: C.text,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}>AI Hiring</div>
                <div style={{ fontSize: '10px', color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {isAdmin ? 'Admin Console' : 'Platform'}
                </div>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: 32, height: 32,
              border: `1px solid ${C.border}`,
              borderRadius: '4px',
              background: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={16} color={C.bg} />
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
            style={{
              width: 26, height: 26,
              borderRadius: '4px',
              background: 'transparent',
              border: `1px solid ${C.divider}`,
              color: C.textFaint,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.textMuted }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.divider; (e.currentTarget as HTMLButtonElement).style.color = C.textFaint }}
          >
            {collapsed
              ? <Menu size={13} />
              : <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} />
            }
          </button>
        </div>

        {/* ── Nav section label ─────────────────────────────── */}
        {!collapsed && (
          <div style={{ padding: '14px 16px 6px', color: C.textFaint, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Navigation
          </div>
        )}

        {/* ── Nav Items ─────────────────────────────────────── */}
        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '10px' : '9px 10px',
                borderRadius: '4px',
                marginBottom: '2px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? C.text : C.textFaint,
                background: isActive ? `rgba(220,159,133,0.08)` : 'transparent',
                border: isActive ? `1px solid ${C.border}` : '1px solid transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
                letterSpacing: '0.01em',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                if (!el.getAttribute('aria-current')) {
                  el.style.background = `rgba(220,159,133,0.05)`
                  el.style.color = C.textMuted
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                if (!el.getAttribute('aria-current')) {
                  el.style.background = 'transparent'
                  el.style.color = C.textFaint
                }
              }}
            >
              <Icon size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
              {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
              {!collapsed && (
                <ChevronRight size={12} style={{ opacity: 0.25, flexShrink: 0 }} />
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Divider ───────────────────────────────────────── */}
        <div style={{ height: '1px', background: C.divider, margin: '0 8px' }} />

        {/* ── User Profile ──────────────────────────────────── */}
        <div style={{ padding: '10px 8px' }}>
          {!collapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '8px 10px',
              borderRadius: '4px',
              background: 'rgba(235,220,196,0.04)',
              border: `1px solid ${C.divider}`,
              marginBottom: '6px',
            }}>
              {/* Avatar */}
              <div style={{
                width: 30, height: 30,
                borderRadius: '4px',
                background: isAdmin ? 'rgba(220,159,133,0.2)' : 'rgba(220,159,133,0.12)',
                border: `1px solid ${C.border}`,
                color: C.accent,
                fontWeight: 700,
                fontSize: '11px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontFamily: "'General Sans', sans-serif",
                letterSpacing: '0.05em',
              }}>
                {initials}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: C.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '0.01em',
                }}>
                  {displayName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {isAdmin
                    ? <ShieldCheck size={9} color={C.accent} />
                    : <UserIcon size={9} color={C.textMuted} />
                  }
                  <span style={{
                    fontSize: '9px',
                    color: isAdmin ? C.accent : C.textMuted,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    {isAdmin ? 'Platform Admin' : 'Recruiter'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '9px',
              padding: collapsed ? '9px' : '8px 10px',
              borderRadius: '4px',
              background: 'transparent',
              border: `1px solid transparent`,
              color: C.textFaint,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              fontFamily: "'General Sans', sans-serif",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,159,133,0.07)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.divider
              ;(e.currentTarget as HTMLButtonElement).style.color = C.accent
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = C.textFaint
            }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main style={{
        flex: 1,
        marginLeft: collapsed ? '64px' : '240px',
        transition: 'margin-left 0.22s ease',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: C.bg,
      }}>
        <Outlet />
      </main>

      {/* ── AI Chatbot (Recruiter only) ───────────────────────── */}
      {!isAdmin && <AIChatbot />}
    </div>
  )
}
