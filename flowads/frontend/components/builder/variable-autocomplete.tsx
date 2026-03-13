'use client'

import { useState, useRef, useEffect } from 'react'

export const VARIABLES = [
  {
    group: 'CLIENTE',
    vars: [
      { name: 'cliente.nome', description: 'Nome do cliente' },
      { name: 'cliente.tipo_negocio', description: 'Tipo de negócio' },
      { name: 'cliente.contexto', description: 'Contexto completo do cliente' },
      { name: 'cliente.whatsapp', description: 'Número WhatsApp do cliente' },
    ],
  },
  {
    group: 'CAMPANHAS',
    vars: [
      { name: 'campanhas.todas', description: 'Lista de todas as campanhas ativas' },
      { name: 'campanha.nome', description: 'Campanha ativa no contexto' },
      { name: 'campanha.contexto', description: 'Contexto daquela campanha' },
      { name: 'campanha.objetivo', description: 'Objetivo da campanha' },
      { name: 'campanha.orcamento', description: 'Orçamento diário' },
      { name: 'campanha.gasto', description: 'Gasto total do período' },
    ],
  },
  {
    group: 'DATA E HORA',
    vars: [
      { name: 'hoje', description: 'Data de hoje (DD/MM/AAAA)' },
      { name: 'semana_atual', description: 'Semana atual' },
      { name: 'mes_atual', description: 'Mês atual por extenso' },
      { name: 'data_formatada', description: 'Data por extenso' },
    ],
  },
  {
    group: 'INPUT DO FLUXO',
    vars: [
      { name: 'input', description: 'Saída completa do bloco anterior' },
      { name: 'input.campo', description: 'Campo específico da saída anterior' },
    ],
  },
  {
    group: 'MÉTRICAS',
    vars: [
      { name: 'metricas.impressoes', description: 'Total de impressões' },
      { name: 'metricas.alcance', description: 'Alcance total' },
      { name: 'metricas.cliques', description: 'Total de cliques' },
      { name: 'metricas.ctr', description: 'Click-through rate (%)' },
      { name: 'metricas.cpc', description: 'Custo por clique' },
      { name: 'metricas.cpm', description: 'Custo por mil impressões' },
      { name: 'metricas.gasto', description: 'Gasto total' },
      { name: 'metricas.roas', description: 'Retorno sobre investimento' },
      { name: 'metricas.periodo', description: 'Período das métricas' },
    ],
  },
  {
    group: 'POSTS INSTAGRAM',
    vars: [
      { name: 'posts.lista', description: 'Lista de posts' },
      { name: 'posts.total', description: 'Total de posts' },
      { name: 'posts.ultimo.url', description: 'URL do último post' },
      { name: 'posts.ultimo.caption', description: 'Legenda do último post' },
    ],
  },
]

interface VariableAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export function VariableAutocomplete({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
}: VariableAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [search, setSearch] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const pos = e.currentTarget.selectionStart || 0
    const text = e.currentTarget.value.slice(0, pos)
    const match = text.match(/\{\{([^}]*)$/)
    if (match) {
      setSearch(match[1])
      setShowDropdown(true)
      setCursorPos(pos - match[0].length)
      // Simple positioning
      setDropdownPos({ top: 60, left: 0 })
    } else {
      setShowDropdown(false)
    }
  }

  const insertVariable = (varName: string) => {
    const before = value.slice(0, cursorPos)
    const afterCursor = value.slice(cursorPos)
    const afterBrace = afterCursor.replace(/^\{\{[^}]*/, '')
    const newValue = `${before}{{${varName}}}${afterBrace}`
    onChange(newValue)
    setShowDropdown(false)
    textareaRef.current?.focus()
  }

  const filteredVars = VARIABLES.map((group) => ({
    ...group,
    vars: group.vars.filter(
      (v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.vars.length > 0)

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={handleKeyUp}
        placeholder={placeholder}
        rows={rows}
        className={`w-full rounded-[10px] bg-surface border border-[var(--border)] text-text px-3 py-2 text-xs focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-text3 ${className}`}
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-64 max-h-52 overflow-y-auto bg-surface border border-[var(--border2)] rounded-[10px] shadow-2xl"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {filteredVars.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text3">Nenhuma variável encontrada</p>
          ) : (
            filteredVars.map((group) => (
              <div key={group.group}>
                <p className="px-3 py-1.5 text-[10px] font-syne font-bold text-text3 bg-bg3 border-b border-[var(--border)]">
                  {group.group}
                </p>
                {group.vars.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-surface2 transition-colors"
                    onMouseDown={() => insertVariable(v.name)}
                  >
                    <p className="text-xs font-mono text-accent">
                      {'{{' + v.name + '}}'}
                    </p>
                    <p className="text-[10px] text-text3">{v.description}</p>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
