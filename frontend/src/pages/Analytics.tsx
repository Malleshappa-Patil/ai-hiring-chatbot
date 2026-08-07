import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { BarChart3, TrendingUp, Users } from 'lucide-react'

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

/* ── Chart color series (earthy, not neon) ─────────────────── */
const CHART_COLORS = {
  applications: '#DC9F85',  // coral rust
  shortlisted:  '#B6A596',  // muted sage
  hired:        '#EBDCC4',  // warm beige
  bar:          '#DC9F85',
}

export default function Analytics() {
  const { data: funnel } = useQuery({ queryKey: ['funnel'], queryFn: () => analyticsApi.funnel() })
  const { data: trends } = useQuery({
    queryKey: ['hiring-trends'],
    queryFn: () => analyticsApi.trends(6),
  })

  const tooltipStyle = {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: '4px',
    color: C.text,
    fontSize: '12px',
    fontFamily: "'General Sans','Inter',sans-serif",
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', fontFamily: "'General Sans','Inter',sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ marginBottom: '28px', paddingBottom: '22px', borderBottom: `1px solid ${C.divider}` }}>
        <h1 style={{
          fontSize: '20px', fontWeight: 700, color: C.text,
          fontFamily: "'Clash Grotesk','General Sans',sans-serif",
          letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <BarChart3 size={18} color={C.accent} /> Analytics Dashboard
        </h1>
        <p style={{ fontSize: '12px', color: C.faint, marginTop: '3px' }}>Hiring funnel, conversion rates, and trends</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>

        {/* ── Hiring Funnel ──────────────────────────────── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '24px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: C.faint, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Users size={13} color={C.accent} /> Hiring Funnel
          </h2>
          {!funnel?.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: C.faint }}>
              <BarChart3 size={36} style={{ opacity: 0.15, marginBottom: '10px', display: 'block', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '12px' }}>No funnel data yet. Start a hiring campaign to see metrics.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.divider} />
                <XAxis type="number" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(220,159,133,0.05)' }} />
                <Bar dataKey="count" fill={C.accent} radius={[0, 4, 4, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Monthly Trends ─────────────────────────────── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '24px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: C.faint, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <TrendingUp size={13} color={C.accent} /> Monthly Trends
          </h2>
          {!trends?.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: C.faint }}>
              <TrendingUp size={36} style={{ opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '12px' }}>No trend data yet. Data accumulates over time.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.divider} />
                <XAxis dataKey="month" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="applications" stroke={CHART_COLORS.applications} strokeWidth={1.5} dot={{ fill: CHART_COLORS.applications, r: 3 }} name="Applications" />
                <Line type="monotone" dataKey="shortlisted" stroke={CHART_COLORS.shortlisted} strokeWidth={1.5} dot={{ fill: CHART_COLORS.shortlisted, r: 3 }} name="Shortlisted" />
                <Line type="monotone" dataKey="hired" stroke={CHART_COLORS.hired} strokeWidth={1.5} dot={{ fill: CHART_COLORS.hired, r: 3 }} name="Hired" />
              </LineChart>
            </ResponsiveContainer>
          )}
          {trends?.length ? (
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
              {[
                { label: 'Applications', color: CHART_COLORS.applications },
                { label: 'Shortlisted', color: CHART_COLORS.shortlisted },
                { label: 'Hired', color: CHART_COLORS.hired },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: '11px', color: C.faint }}>{l.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── Conversion Rates Table ─────────────────────── */}
        {funnel?.length ? (
          <div style={{
            gridColumn: '1 / -1',
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: '4px', padding: '24px',
          }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: C.faint, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>
              Stage Conversion Rates
            </h2>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  {['Stage', 'Candidates', 'Conversion Rate', 'Progress'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: '9px', color: C.faint,
                      padding: '0 12px 8px', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funnel.map(row => (
                  <tr key={row.stage}>
                    <td style={{ padding: '10px 12px', background: C.panelAlt, borderRadius: '4px 0 0 4px', color: C.muted, fontSize: '13px', borderLeft: `1px solid ${C.divider}`, borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}` }}>
                      {row.stage}
                    </td>
                    <td style={{ padding: '10px 12px', background: C.panelAlt, color: C.text, fontSize: '13px', fontWeight: 600, borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}` }}>
                      {row.count}
                    </td>
                    <td style={{ padding: '10px 12px', background: C.panelAlt, color: C.accent, fontSize: '13px', fontWeight: 600, borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}` }}>
                      {row.conversion_rate}%
                    </td>
                    <td style={{ padding: '10px 12px', background: C.panelAlt, borderRadius: '0 4px 4px 0', borderRight: `1px solid ${C.divider}`, borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}` }}>
                      <div style={{ width: '100%', height: '5px', background: C.divider, borderRadius: '2px' }}>
                        <div style={{ width: `${row.conversion_rate}%`, height: '100%', borderRadius: '2px', background: C.accent, opacity: 0.75, transition: 'width 0.5s ease' }} />
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
