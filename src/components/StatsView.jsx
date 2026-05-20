import { useState, useEffect } from 'react'

const api = window.golem

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(Math.round(n))
}

function fmtMs(ms) {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's'
  return Math.round(ms) + 'ms'
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1"
      style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        <span className="text-[12px] font-medium text-on-surface-variant/60 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[28px] font-bold text-on-surface leading-none" style={{ fontFamily: 'Hanken Grotesk' }}>{value}</div>
      {sub && <div className="text-[12px] text-on-surface-variant/50 mt-1">{sub}</div>}
    </div>
  )
}

function BarChart({ data, valueKey = 'messages', label = 'messages' }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)

  return (
    <div className="flex items-end gap-1 h-28 w-full">
      {data.map((d, i) => {
        const height = Math.max((d[valueKey] / max) * 100, d[valueKey] > 0 ? 4 : 0)
        const date = new Date(d.day + 'T12:00:00')
        const isToday = d.day === new Date().toISOString().split('T')[0]
        const showLabel = i === 0 || i === data.length - 1 || date.getDay() === 1

        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            {d[valueKey] > 0 && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="rounded-lg px-2 py-1 text-[11px] whitespace-nowrap"
                  style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="font-medium text-on-surface">{d[valueKey]} {label}</div>
                  <div className="text-on-surface-variant/60">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
              </div>
            )}
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${height}%`,
                background: isToday
                  ? 'linear-gradient(180deg, #818cf8 0%, #6366f1 100%)'
                  : d[valueKey] > 0 ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.04)',
                minHeight: '3px',
              }}
            />
            {showLabel && (
              <span className="text-[9px] text-on-surface-variant/30 absolute -bottom-4">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function StatsView() {
  const [data, setData] = useState(null)
  const [chartMode, setChartMode] = useState('messages') // 'messages' | 'tokens'

  useEffect(() => {
    async function load() {
      const summary = await api.db.getTelemetrySummary()
      // Fill last 30 days with zeros
      const days = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push({ day: d.toISOString().split('T')[0], messages: 0, tokens: 0 })
      }
      for (const row of summary.dailyLast30) {
        const entry = days.find(d => d.day === row.day)
        if (entry) { entry.messages = row.messages; entry.tokens = row.tokens }
      }
      setData({ ...summary, chartDays: days })
    }
    load()
  }, [])

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex gap-1.5">
          {[0, 160, 320].map(d => (
            <span key={d} className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/30"
              style={{ animation: `thinking-dot 1.4s ease-in-out ${d}ms infinite` }} />
          ))}
        </div>
      </div>
    )
  }

  const { allTime, thisWeek, today, topModels, chartDays } = data
  const totalModels = topModels.reduce((s, m) => s + m.count, 0)
  const hasData = allTime.messages > 0

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="px-8 py-8 max-w-[900px] mx-auto flex flex-col gap-6">

        <div>
          <h2 className="text-[32px] font-bold text-on-surface" style={{ fontFamily: 'Hanken Grotesk', letterSpacing: '-0.02em' }}>
            Usage Stats
          </h2>
          <p className="text-body-lg text-on-surface-variant mt-1">
            Telemetry captured from Ollama — exact token counts and timing per response.
          </p>
        </div>

        {!hasData ? (
          <div className="rounded-xl p-12 flex flex-col items-center gap-3 text-center"
            style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20">bar_chart</span>
            <div className="text-on-surface-variant/50 text-[15px]">No data yet — send some messages to see stats here.</div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon="forum" label="All-time messages" value={fmt(allTime.messages)} />
              <StatCard icon="token" label="Total tokens" value={fmt(allTime.total_tokens)}
                sub={`${fmt(allTime.completion_tokens)} generated`} />
              <StatCard icon="speed" label="Avg time to first token" value={fmtMs(allTime.avg_ttft)}
                sub={`${fmtMs(allTime.avg_duration)} avg total`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="today" label="Today" value={fmt(today.messages)}
                sub={`${fmt(today.total_tokens)} tokens`} />
              <StatCard icon="date_range" label="This week" value={fmt(thisWeek.messages)}
                sub={`${fmt(thisWeek.total_tokens)} tokens`} />
            </div>

            {/* Chart */}
            <div className="rounded-xl p-6"
              style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-[14px] font-medium text-on-surface">Last 30 days</div>
                  <div className="text-[12px] text-on-surface-variant/50 mt-0.5">Hover bars for details</div>
                </div>
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[['messages', 'Messages'], ['tokens', 'Tokens']].map(([mode, lbl]) => (
                    <button key={mode} onClick={() => setChartMode(mode)}
                      className="px-3 py-1.5 text-[12px] font-medium transition-colors"
                      style={{
                        background: chartMode === mode ? 'rgba(99,102,241,0.2)' : 'transparent',
                        color: chartMode === mode ? '#a5b4fc' : 'rgba(196,192,216,0.5)',
                      }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pb-6">
                <BarChart data={chartDays} valueKey={chartMode} label={chartMode} />
              </div>
            </div>

            {/* Top models */}
            {topModels.length > 0 && (
              <div className="rounded-xl p-6"
                style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-[14px] font-medium text-on-surface mb-4">Models used</div>
                <div className="flex flex-col gap-3">
                  {topModels.map(m => {
                    const pct = totalModels > 0 ? (m.count / totalModels) * 100 : 0
                    return (
                      <div key={m.model}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] font-mono text-on-surface/80 truncate">{m.model}</span>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-[12px] text-on-surface-variant/50">{fmt(m.tokens)} tokens</span>
                            <span className="text-[12px] font-medium text-on-surface-variant">{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #818cf8)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
