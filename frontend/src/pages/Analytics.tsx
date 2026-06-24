import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, FunnelChart, Funnel, LabelList,
} from 'recharts'
import { BarChart3, TrendingUp, Users } from 'lucide-react'

export default function Analytics() {
  const { data: funnel } = useQuery({ queryKey: ['funnel'], queryFn: () => analyticsApi.funnel() })
  const { data: trends, isLoading } = useQuery({
    queryKey: ['hiring-trends'],
    queryFn: () => analyticsApi.trends(6),
  })

  const tooltipStyle = {
    background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '8px', color: '#e2e8f0', fontSize: '13px',
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={22} color="#6366f1" /> Analytics Dashboard
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>Hiring funnel, conversion rates, and trends</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Hiring Funnel */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '24px',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={15} /> Hiring Funnel
          </h2>
          {!funnel?.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568' }}>
              <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '13px' }}>No funnel data yet. Start a hiring campaign to see metrics.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[0, 6, 6, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Hiring Trends */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '24px',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={15} /> Monthly Trends
          </h2>
          {!trends?.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568' }}>
              <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '13px' }}>No trend data yet. Data accumulates over time.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="applications" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} name="Applications" />
                <Line type="monotone" dataKey="shortlisted" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Shortlisted" />
                <Line type="monotone" dataKey="hired" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="Hired" />
              </LineChart>
            </ResponsiveContainer>
          )}
          {trends?.length && (
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
              {[
                { label: 'Applications', color: '#6366f1' },
                { label: 'Shortlisted', color: '#10b981' },
                { label: 'Hired', color: '#f59e0b' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversion rates table */}
        {funnel?.length ? (
          <div style={{
            gridColumn: '1 / -1',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '24px',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '16px' }}>
              Stage Conversion Rates
            </h2>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead>
                <tr>
                  {['Stage', 'Candidates', 'Conversion Rate', 'Progress'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: '12px', color: '#475569', padding: '0 12px 8px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funnel.map(row => (
                  <tr key={row.stage}>
                    <td style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px 0 0 8px', color: '#94a3b8', fontSize: '14px' }}>
                      {row.stage}
                    </td>
                    <td style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>
                      {row.count}
                    </td>
                    <td style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', color: '#6366f1', fontSize: '14px', fontWeight: 600 }}>
                      {row.conversion_rate}%
                    </td>
                    <td style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '0 8px 8px 0' }}>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
                        <div style={{ width: `${row.conversion_rate}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #6366f1, #a78bfa)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
