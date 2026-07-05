import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import AIChatbot from '@/components/chatbot/AIChatbot'

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/jobs',       label: 'Job Management',     icon: Briefcase },
  { to: '/candidates', label: 'Candidates',         icon: Users },
  { to: '/workflow',   label: 'Workflow Monitor',   icon: GitBranch },
  { to: '/analytics',  label: 'Analytics',          icon: BarChart3 },
  { to: '/onboarding', label: 'Onboarding',         icon: ClipboardCheck },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f1a' }}>
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        style={{
          width: collapsed ? '72px' : '260px',
          minHeight: '100vh',
          background: 'rgba(255,255,255,0.03)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
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
          /* ── Collapsed header: just the toggle button, centered ── */
          <div style={{
            padding: '16px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            minHeight: '64px',
          }}>
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.2)',
                color: '#818cf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.25)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.45)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#a5b4fc'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#818cf8'
              }}
            >
              <Menu size={16} />
            </button>
          </div>
        ) : (
          /* ── Expanded header: logo + text + collapse button ── */
          <div style={{
            padding: '16px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            minHeight: '64px',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', minWidth: 0 }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bot size={20} color="white" />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#e2e8f0', lineHeight: 1.2, whiteSpace: 'nowrap' }}>AI Hiring</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Platform</div>
              </div>
            </div>

            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.2)',
                color: '#818cf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.25)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.45)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#a5b4fc'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#818cf8'
              }}
            >
              <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                marginBottom: '4px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#818cf8' : '#94a3b8',
                background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
              {!collapsed && <ChevronRight size={14} style={{ opacity: 0.4 }} />}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'none',
              border: '1px solid transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.2)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
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

      {/* ── AI Hiring Chatbot (Global Floating Panel) ─────────── */}
      <AIChatbot />
    </div>
  )
}
