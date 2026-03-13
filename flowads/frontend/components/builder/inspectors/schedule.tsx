'use client'

import type { InspectorFieldProps } from '../inspector'

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function ScheduleInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })
  const toggleDay = (key: string) => {
    const days = (config.days as string[] | undefined) || []
    onChange({
      ...config,
      days: days.includes(key) ? days.filter((d) => d !== key) : [...days, key],
    })
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">FREQUÊNCIA</label>
        <select
          value={(config.frequency as string) || 'daily'}
          onChange={(e) => set('frequency', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          <option value="daily">Diário</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
          <option value="custom">Personalizado</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">HORA</label>
        <input
          type="time"
          value={(config.time as string) || '08:00'}
          onChange={(e) => set('time', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        />
      </div>

      {config.frequency === 'weekly' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">DIAS DA SEMANA</label>
          <div className="flex flex-wrap gap-1">
            {DAYS.map((day, i) => {
              const key = DAY_KEYS[i]
              const selected = ((config.days as string[]) || []).includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`px-2 py-1 rounded-[6px] text-[10px] font-syne font-bold transition-colors border ${
                    selected
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-surface text-text3 border-[var(--border)] hover:border-[var(--border2)]'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {config.frequency === 'monthly' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">DIA DO MÊS</label>
          <select
            value={(config.day_of_month as number) || 1}
            onChange={(e) => set('day_of_month', parseInt(e.target.value))}
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {config.frequency === 'custom' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">EXPRESSÃO CRON</label>
          <input
            value={(config.cron as string) || '0 8 * * *'}
            onChange={(e) => set('cron', e.target.value)}
            placeholder="0 8 * * 1"
            className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs font-mono focus:outline-none focus:border-accent"
          />
          <p className="text-[10px] text-text3">
            Próxima execução baseada na expressão acima
          </p>
        </div>
      )}
    </>
  )
}
