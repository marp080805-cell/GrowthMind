'use client'

import { useState } from 'react'

interface OutputTreeProps {
  data: unknown
  draggable?: boolean
  path?: string
  depth?: number
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function TreeNode({
  keyName,
  value,
  path,
  draggable,
  depth,
}: {
  keyName: string
  value: unknown
  path: string
  draggable: boolean
  depth: number
}) {
  const [open, setOpen] = useState(depth < 2)

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isComplex = isObject || isArray

  const varPath = `{{${path}}}`

  if (isComplex) {
    const entries = isArray
      ? (value as unknown[]).map((v, i) => [`[${i}]`, v] as [string, unknown])
      : Object.entries(value as Record<string, unknown>)

    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 w-full text-left hover:bg-surface2 rounded px-1 py-0.5 transition-colors"
          style={{ paddingLeft: depth * 10 + 4 }}
        >
          <span className="text-text3 text-[9px] w-3 shrink-0">{open ? '▼' : '▶'}</span>
          <span className="text-blue-400 font-mono text-[10px] truncate">{keyName}</span>
          <span className="text-text3 text-[10px] ml-1">
            {isArray ? `[${(value as unknown[]).length}]` : '{…}'}
          </span>
          {draggable && (
            <span
              draggable
              onDragStart={(e) => {
                e.stopPropagation()
                e.dataTransfer.setData('text/plain', varPath)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={(e) => {
                e.stopPropagation()
                copyToClipboard(varPath)
              }}
              className="ml-auto text-[9px] text-text3 hover:text-accent cursor-grab px-1 shrink-0"
              title={`Copiar ${varPath}`}
            >
              📋
            </span>
          )}
        </button>
        {open && (
          <div>
            {entries.map(([k, v]) => {
              const childPath = k.startsWith('[') ? `${path}.${k}` : `${path}.${k}`
              return (
                <TreeNode
                  key={k}
                  keyName={k}
                  value={v}
                  path={childPath}
                  draggable={draggable}
                  depth={depth + 1}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Leaf node
  const displayValue =
    value === null
      ? 'null'
      : value === undefined
        ? 'undefined'
        : typeof value === 'string'
          ? `"${String(value).slice(0, 40)}${String(value).length > 40 ? '…' : ''}"`
          : String(value)

  return (
    <div
      className={`flex items-center gap-1 hover:bg-surface2 rounded px-1 py-0.5 transition-colors group ${draggable ? 'cursor-grab' : ''}`}
      style={{ paddingLeft: depth * 10 + 4 }}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData('text/plain', varPath)
              e.dataTransfer.effectAllowed = 'copy'
            }
          : undefined
      }
    >
      <span className="w-3 shrink-0" />
      <span className="text-blue-400 font-mono text-[10px] shrink-0">{keyName}</span>
      <span className="text-text3 text-[10px] mx-0.5">:</span>
      <span className="text-green-400 font-mono text-[10px] truncate flex-1">{displayValue}</span>
      {draggable && (
        <button
          type="button"
          onClick={() => copyToClipboard(varPath)}
          className="opacity-0 group-hover:opacity-100 text-[9px] text-text3 hover:text-accent transition-opacity shrink-0"
          title={`Copiar ${varPath}`}
        >
          📋
        </button>
      )}
    </div>
  )
}

export function OutputTree({ data, draggable = false, path = 'output', depth = 0 }: OutputTreeProps) {
  if (data === null || data === undefined) {
    return <p className="text-[10px] text-text3 px-2 py-1 italic">Sem dados</p>
  }

  const isObject = typeof data === 'object' && !Array.isArray(data)
  const isArray = Array.isArray(data)

  if (isObject || isArray) {
    const entries = isArray
      ? (data as unknown[]).map((v, i) => [`[${i}]`, v] as [string, unknown])
      : Object.entries(data as Record<string, unknown>)

    return (
      <div className="font-mono">
        {entries.map(([k, v]) => {
          const childPath = path ? `${path}.${k}` : k
          return (
            <TreeNode
              key={k}
              keyName={k}
              value={v}
              path={childPath}
              draggable={draggable}
              depth={depth}
            />
          )
        })}
      </div>
    )
  }

  // Primitive root
  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 ${draggable ? 'cursor-grab hover:bg-surface2 rounded' : ''}`}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData('text/plain', `{{${path}}}`)
              e.dataTransfer.effectAllowed = 'copy'
            }
          : undefined
      }
    >
      <span className="text-green-400 font-mono text-[10px]">{String(data)}</span>
    </div>
  )
}
