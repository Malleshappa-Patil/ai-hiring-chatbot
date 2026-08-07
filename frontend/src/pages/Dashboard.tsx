import { useQuery } from '@tanstack/react-query'
import { analyticsApi, jobsApi, authApi, candidatesApi } from '@/api'
import {
  Briefcase, Users, Calendar, TrendingUp,
  BarChart2, Bot, Zap, ArrowUpRight, Building,
} from 'lucide-react'

/* ── Editorial colour tokens ─────────────────────────────────── */
const C = {
  bg:       '#181818',
  panel:    '#1E1A18',
  panelAlt: '#221D1A',
  text:     '#EBDCC4',
  muted:    '#B6A596',
  faint:    '#7A6A5E',
  accent:   '#DC9F85',
  border:   '#66473B',
  divider:  '#35211A',
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: string
}

function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: '4px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      transition: 'border-color 0.2s ease',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.accent }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: C.faint, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <div style={{
          width: '32px', height: '32px', borderRadius: '4px',
          background: `rgba(220,159,133,0.1)`,
          border: `1px solid ${C.divider}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.accent,
        }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{
          fontSize: '28px', fontWeight: 700,
          color: C.text, lineHeight: 1,
          fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
        }}>
          {value}
        </div>
        {trend && (
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={12} color={C.accent} />
            <span style={{ fontSize: '11px', color: C.muted, letterSpacing: '0.05em' }}>{trend}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ['auth-me'],
    queryFn: authApi.me,
  })

  const isAdmin = user?.role === 'admin'

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: analyticsApi.dashboard,
    enabled: !isAdmin,
  })

  const { data: jobs } = useQuery({
    queryKey: ['jobs-recent'],
    queryFn: () => jobsApi.list({ page: 1, page_size: 100 }),
  })

  const { data: candidatesRes } = useQuery({
    queryKey: ['candidates-all'],
    queryFn: () => candidatesApi.list({ page: 1 }),
  })

  const { data: companiesData, isLoading: isCompaniesLoading } = useQuery({
    queryKey: ['hireboard-companies'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8001/companies')
      if (!res.ok) return []
      const json = await res.json()
      return json.companies || []
    },
    enabled: isAdmin,
  })

  const allCandidates = candidatesRes?.items || []
  const hiredCandidatesCount = allCandidates.filter(
    (c: any) => c.status === 'selected' || c.status === 'onboarding' || c.status === 'hired'
  ).length

  const registeredCompaniesCount = companiesData?.length || 1

  /* ── ADMIN VIEW ─────────────────────────────────────────────── */
  if (isAdmin) {
    const adminStats = [
      { label: 'Registered Companies', value: registeredCompaniesCount, icon: <Building size={16} />, trend: 'Live on HireBoard' },
      { label: 'Candidates Hired',     value: hiredCandidatesCount,     icon: <Users size={16} />,    trend: 'Selected & Onboarded' },
      { label: 'Active Job Openings',  value: jobs?.total || 0,         icon: <Briefcase size={16} />,trend: 'Across all companies' },
    ]

    return (
      <div style={{
        padding: '32px',
        maxWidth: '1400px',
        fontFamily: "'General Sans', 'Inter', sans-serif",
        color: C.text,
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '4px',
              background: `rgba(220,159,133,0.12)`,
              border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.accent,
            }}>
              <Building size={20} />
            </div>
            <div>
              <h1 style={{
                fontSize: '22px', fontWeight: 700, color: C.text,
                fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
                letterSpacing: '-0.01em',
              }}>
                Platform Administration
              </h1>
              <p style={{ fontSize: '13px', color: C.faint, marginTop: '2px', letterSpacing: '0.01em' }}>
                Global overview of registered companies and candidate hiring statistics
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}>
          {adminStats.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Registered Companies Table */}
        <div style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: '4px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{
                fontSize: '16px', fontWeight: 700, color: C.text,
                display: 'flex', alignItems: 'center', gap: '9px',
                fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
              }}>
                <Building size={16} color={C.accent} /> Registered Companies
              </h2>
              <p style={{ fontSize: '12px', color: C.faint, marginTop: '3px', letterSpacing: '0.01em' }}>
                Companies registered and actively operating on the AI Hiring Platform
              </p>
            </div>
            <span style={{
              fontSize: '10px', padding: '4px 10px', borderRadius: '4px',
              background: `rgba(220,159,133,0.1)`, color: C.accent,
              border: `1px solid ${C.border}`, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {registeredCompaniesCount} {registeredCompaniesCount === 1 ? 'Company' : 'Companies'} Total
            </span>
          </div>

          {isCompaniesLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '13px' }}>
              Loading registered companies...
            </div>
          ) : companiesData?.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.divider}`, color: C.faint, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    <th style={{ padding: '10px 14px' }}>Company</th>
                    <th style={{ padding: '10px 14px' }}>Industry</th>
                    <th style={{ padding: '10px 14px' }}>Location</th>
                    <th style={{ padding: '10px 14px' }}>Team Size</th>
                    <th style={{ padding: '10px 14px' }}>Registered Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companiesData.map((co: any) => (
                    <tr key={co.id} style={{ borderBottom: `1px solid ${C.divider}`, transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = `rgba(220,159,133,0.03)`}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px', color: C.text, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '4px',
                            background: `rgba(235,220,196,0.06)`, border: `1px solid ${C.divider}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, color: C.muted, flexShrink: 0,
                          }}>
                            {co.name ? co.name.substring(0, 2).toUpperCase() : 'CO'}
                          </div>
                          <div>
                            <div>{co.name}</div>
                            <div style={{ fontSize: '11px', color: C.faint, fontWeight: 400 }}>{co.tagline || 'Registered Enterprise'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px', color: C.muted }}>{co.industry || 'Technology'}</td>
                      <td style={{ padding: '14px', color: C.muted }}>{co.location || 'Global / Remote'}</td>
                      <td style={{ padding: '14px', color: C.muted }}>{co.team_size || '10-100'}</td>
                      <td style={{ padding: '14px', color: C.faint, fontSize: '12px' }}>
                        {co.created_at ? new Date(co.created_at).toLocaleDateString() : 'Active'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '9px',
                          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                          background: 'rgba(107,158,126,0.1)', color: '#8ab4a0',
                          border: '1px solid rgba(107,158,126,0.2)',
                        }}>
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '13px' }}>
              No registered companies found.
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── RECRUITER VIEW ─────────────────────────────────────────── */
  const stats = [
    { label: 'Active Jobs',          value: metrics?.active_jobs ?? '—',         icon: <Briefcase size={16} />,  trend: '+2 this week' },
    { label: 'Total Candidates',     value: metrics?.total_candidates ?? '—',     icon: <Users size={16} />,      trend: '+18 new' },
    { label: 'Interviews This Week', value: metrics?.interviews_this_week ?? '—', icon: <Calendar size={16} />,   trend: 'On track' },
    { label: 'Offers Made',          value: metrics?.offers_made ?? '—',          icon: <TrendingUp size={16} />, trend: '3 accepted' },
    { label: 'Screening Pass Rate',  value: metrics ? `${metrics.screening_pass_rate}%` : '—', icon: <BarChart2 size={16} /> },
  ]

  const agentStatusItems = [
    'Supervisor Agent', 'Planning Agent', 'JD Agent',
    'Sourcing Agent', 'Screening Agent', 'Interview Agent', 'Onboarding Agent',
  ]

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1400px',
      fontFamily: "'General Sans', 'Inter', sans-serif",
      color: C.text,
    }}>
      {/* Header */}
      <div style={{ marginBottom: '28px', paddingBottom: '22px', borderBottom: `1px solid ${C.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '4px',
            background: `rgba(220,159,133,0.12)`,
            border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.accent,
          }}>
            <Bot size={20} />
          </div>
          <div>
            <h1 style={{
              fontSize: '20px', fontWeight: 700, color: C.text,
              fontFamily: "'Clash Grotesk', 'General Sans', sans-serif",
              letterSpacing: '-0.01em',
            }}>
              Recruitment Dashboard
            </h1>
            <p style={{ fontSize: '12px', color: C.faint, marginTop: '2px', letterSpacing: '0.01em' }}>
              Enterprise Multi-Agent Hiring Platform — Real-time overview
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '14px',
        marginBottom: '28px',
      }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Two-col section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
        {/* Recent Jobs */}
        <div style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: '4px',
          padding: '22px',
        }}>
          <h2 style={{
            fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '8px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            <Briefcase size={14} color={C.accent} /> Recent Jobs
          </h2>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '56px' }} />)}
            </div>
          ) : jobs?.items.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {jobs.items.map(job => (
                <div key={job.id} style={{
                  padding: '12px 14px',
                  background: C.panelAlt,
                  border: `1px solid ${C.divider}`,
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.12s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.border}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.divider}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: C.text }}>{job.title}</div>
                    <div style={{ fontSize: '11px', color: C.faint, marginTop: '2px' }}>{job.department} · {job.location}</div>
                  </div>
                  <span className={`badge badge-${job.status === 'published' ? 'success' : job.status === 'pending_approval' ? 'warning' : 'neutral'}`}>
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: C.faint }}>
              <Briefcase size={36} style={{ marginBottom: '10px', opacity: 0.25 }} />
              <p style={{ fontSize: '13px' }}>No active jobs yet. Create your first job to get started.</p>
            </div>
          )}
        </div>

        {/* Agent Status Panel */}
        <div style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: '4px',
          padding: '22px',
        }}>
          <h2 style={{
            fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '14px',
            display: 'flex', alignItems: 'center', gap: '8px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            <Zap size={14} color={C.accent} /> Agent Status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {agentStatusItems.map(agent => (
              <div key={agent} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 11px',
                background: C.panelAlt,
                borderRadius: '4px',
                border: `1px solid ${C.divider}`,
              }}>
                <span style={{ fontSize: '12px', color: C.muted }}>{agent}</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '9px', fontWeight: 700, color: C.faint,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  <span style={{
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: C.divider, display: 'inline-block',
                  }} />
                  idle
                </span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '14px', fontSize: '11px', color: C.divider, textAlign: 'center', letterSpacing: '0.05em' }}>
            Agents activate when a workflow is started
          </p>
        </div>
      </div>
    </div>
  )
}
