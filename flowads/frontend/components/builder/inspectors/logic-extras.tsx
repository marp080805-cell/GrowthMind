'use client'

import { VariableAutocomplete } from '../variable-autocomplete'
import type { InspectorFieldProps } from '../inspector'

const OPERATORS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'contains', label: 'contém' },
  { value: 'not_contains', label: 'não contém' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'not_empty', label: 'não está vazio' },
]

export function FilterInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3 mb-1">
        <p className="font-syne font-bold text-accent mb-1">Como usar</p>
        <p>Filtra o array recebido como input. Defina o campo e a condição abaixo.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">CAMPO</label>
        <VariableAutocomplete
          value={(config.field as string) || ''}
          onChange={(v) => set('field', v)}
          placeholder="status, ctr, name..."
          rows={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">OPERADOR</label>
        <select
          value={(config.operator as string) || '='}
          onChange={(e) => set('operator', e.target.value)}
          className="h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent"
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>

      {config.operator !== 'is_empty' && config.operator !== 'not_empty' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-syne font-semibold text-text3">VALOR</label>
          <VariableAutocomplete
            value={(config.value as string) || ''}
            onChange={(v) => set('value', v)}
            placeholder="ACTIVE, 2.5, ..."
            rows={1}
          />
        </div>
      )}

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Exemplo</p>
        <p>campo: <code className="text-accent">status</code></p>
        <p>operador: <code className="text-accent">=</code></p>
        <p>valor: <code className="text-accent">ACTIVE</code></p>
        <p className="mt-1">→ retorna só os itens ativos</p>
      </div>
    </>
  )
}

export function TransformInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3 mb-1">
        <p className="font-syne font-bold text-accent mb-1">Como usar</p>
        <p>Defina o JSON de saída. Use <code className="text-accent">{'{{variavel}}'}</code> para interpolar dados do fluxo.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-syne font-semibold text-text3">TEMPLATE DE SAÍDA</label>
        <VariableAutocomplete
          value={(config.template as string) || ''}
          onChange={(v) => set('template', v)}
          placeholder={'{\n  "resumo": "{{metricas.gasto}}",\n  "cliente": "{{cliente.nome}}"\n}'}
          rows={7}
          className="font-mono"
        />
      </div>
    </>
  )
}

export function MergeInspector({ config, onChange }: InspectorFieldProps) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <>
      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Mesclar dados</p>
        <p>Conecte dois caminhos do fluxo neste bloco. Os dados de ambas as entradas (<strong>A</strong> e <strong>B</strong>) serão combinados em um único objeto.</p>
      </div>

      <div className="bg-accent/5 rounded-[8px] p-2.5 border border-accent/10 text-[10px] text-text3">
        <p className="font-syne font-bold text-accent mb-1">Entradas</p>
        <p>🅰️ <strong>a</strong> — primeira entrada</p>
        <p>🅱️ <strong>b</strong> — segunda entrada</p>
        <p className="mt-1">Em caso de conflito de chaves, a entrada B tem prioridade.</p>
      </div>
    </>
  )
}

export function StopInspector({ config, onChange }: InspectorFieldProps) {
  return (
    <div className="bg-red/10 rounded-[8px] p-3 border border-red/20 text-[11px] text-text3">
      <p className="font-syne font-bold text-red mb-1">Parar execução</p>
      <p>Este bloco encerra a execução do fluxo imediatamente quando atingido.</p>
      <p className="mt-2">Use após um <strong>Condicional (IF)</strong> para parar quando uma condição for verdadeira ou falsa.</p>
    </div>
  )
}
