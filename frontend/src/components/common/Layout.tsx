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
  Menu,
  ChevronRight,
  Building,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react'
import AIChatbot from '@/components/chatbot/AIChatbot'

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
    : (user?.company_name || user?.full_name || 'Company Recruiter')

  const initials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'AD'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        style={{
          width: collapsed ? '72px' : '260px',
          minHeight: '100vh',
          background: '#111111',
          borderRight: '1px solid #1e1e1e',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s ease',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          overflow: 'hidden',
        }}
      >
        {/* Logo + Toggle */}
        {collapsed ? (
          /* ── Collapsed header ── */
          <div style={{
            padding: '16px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #1e1e1e',
            minHeight: '64px',
          }}>
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                color: '#888888',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              <Menu size={16} />
            </button>
          </div>
        ) : (
          /* ── Expanded header ── */
          <div style={{
            padding: '16px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #1e1e1e',
            minHeight: '64px',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', minWidth: 0 }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bot size={20} color="#0a0a0a" />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff', lineHeight: 1.2, whiteSpace: 'nowrap' }}>AI Hiring</div>
                <div style={{ fontSize: '11px', color: '#555555' }}>{isAdmin ? 'Admin Console' : 'Platform'}</div>
              </div>
            </div>

            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                color: '#555555',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '4px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#ffffff' : '#555555',
                background: isActive ? '#1e1e1e' : 'transparent',
                border: isActive ? '1px solid #2a2a2a' : '1px solid transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
              {!collapsed && <ChevronRight size={14} style={{ opacity: 0.3 }} />}
            </NavLink>
          ))}
        </nav>

        {/* Profile Section (Bottom-Left Corner) */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #1e1e1e', background: 'rgba(0,0,0,0.2)' }}>
          {!collapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: '#161616',
              border: '1px solid #262626',
              marginBottom: '8px',
            }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: isAdmin ? '#8b5cf6' : '#0ea5e9',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {displayName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {isAdmin ? <ShieldCheck size={11} color="#a78bfa" /> : <UserIcon size={11} color="#38bdf8" />}
                  <span style={{ fontSize: '10px', color: isAdmin ? '#a78bfa' : '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                    {isAdmin ? 'Platform Admin' : 'Recruiter'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            title="Sign out of account"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'none',
              border: '1px solid transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.1)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239, 68, 68, 0.2)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
            }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          marginLeft: collapsed ? '72px' : '260px',
          transition: 'margin-left 0.25s ease',
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <Outlet />
      </main>

      {/* ── AI Hiring Chatbot (Global Floating Panel - Recruiter Only) ── */}
      {!isAdmin && <AIChatbot />}
    </div>
  )
}
