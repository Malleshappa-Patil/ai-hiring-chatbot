import { useQuery } from '@tanstack/react-query'
import { analyticsApi, jobsApi } from '@/api'
import {
  Briefcase, Users, Calendar, TrendingUp,
  BarChart2, Bot, Zap, ArrowUpRight,
} from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  color: string
}

function StatCard({ label, value, icon, trend, color }: StatCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={e => {
      ;(e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`
      ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${color}15`
    }}
    onMouseLeave={e => {
      ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'
      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{label}</span>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>
          {value}
        </div>
        {trend && (
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={13} color="#10b981" />
            <span style={{ fontSize: '12px', color: '#10b981' }}>{trend}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: analyticsApi.dashboard,
  })

  const { data: jobs } = useQuery({
    queryKey: ['jobs-recent'],
    queryFn: () => jobsApi.list({ page: 1, page_size: 5 }),
  })

  const stats = [
    { label: 'Active Jobs',        value: metrics?.active_jobs ?? '—',          icon: <Briefcase size={18} />,  color: '#6366f1', trend: '+2 this week' },
    { label: 'Total Candidates',   value: metrics?.total_candidates ?? '—',      icon: <Users size={18} />,      color: '#a78bfa', trend: '+18 new' },
    { label: 'Interviews This Week', value: metrics?.interviews_this_week ?? '—', icon: <Calendar size={18} />,   color: '#10b981', trend: 'On track' },
    { label: 'Offers Made',         value: metrics?.offers_made ?? '—',           icon: <TrendingUp size={18} />, color: '#f59e0b', trend: '3 accepted' },
    { label: 'Screening Pass Rate', value: metrics ? `${metrics.screening_pass_rate}%` : '—',   icon: <BarChart2 size={18} />, color: '#ec4899' },
  ]

  const agentStatusItems = [
    { agent: 'Supervisor Agent',  status: 'idle',    color: '#64748b' },
    { agent: 'Planning Agent',    status: 'idle',    color: '#64748b' },
    { agent: 'JD Agent',          status: 'idle',    color: '#64748b' },
    { agent: 'Sourcing Agent',    status: 'idle',    color: '#64748b' },
    { agent: 'Screening Agent',   status: 'idle',    color: '#64748b' },
    { agent: 'Interview Agent',   status: 'idle',    color: '#64748b' },
    { agent: 'Onboarding Agent',  status: 'idle',    color: '#64748b' },
  ]

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#e2e8f0' }}>
              Recruitment Dashboard
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Enterprise Multi-Agent Hiring Platform — Real-time overview
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
      }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two-col section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
        {/* Recent Jobs */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={18} color="#6366f1" /> Recent Jobs
          </h2>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1,2,3].map(i => (
                <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '10px' }} />
              ))}
            </div>
          ) : jobs?.items.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {jobs.items.map(job => (
                <div key={job.id} style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0' }}>{job.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{job.department} · {job.location}</div>
                  </div>
                  <span className={`badge badge-${job.status === 'published' ? 'success' : job.status === 'pending_approval' ? 'warning' : 'neutral'}`}>
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568' }}>
              <Briefcase size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p style={{ fontSize: '14px' }}>No active jobs yet. Create your first job to get started.</p>
            </div>
          )}
        </div>

        {/* Agent Status Panel */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#f59e0b" /> Agent Status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agentStatusItems.map(({ agent, status }) => (
              <div key={agent} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>{agent}</span>
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#475569', display: 'inline-block',
                  }} />
                  {status}
                </span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '16px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
            Agents activate when a workflow is started
          </p>
        </div>
      </div>
    </div>
  )
}
