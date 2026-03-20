'use client'

import { useState } from 'react'
import { BLOCKS_BY_CATEGORY, CATEGORY_LABELS, CATEGORY_COLORS, type Category } from '@/lib/blocks'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES: Category[] = ['triggers', 'meta', 'ai', 'whatsapp', 'notion', 'drive', 'logic', 'utils']

export function BlockPalette() {
  const [search, setSearch] = useState('')

  const onDragStart = (e: React.DragEvent, blockType: string) => {
    e.dataTransfer.setData('application/admind-block', blockType)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-[230px] h-full bg-bg2 border-r border-[var(--border)] flex flex-col overflow-hidden shrink-0">
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bloco..."
            className="w-full h-8 pl-8 pr-3 rounded-[8px] bg-surface border border-[var(--border)] text-text text-xs placeholder:text-text3 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {CATEGORIES.map((cat) => {
          const blocks = BLOCKS_BY_CATEGORY[cat] || []
          const filtered = search
            ? blocks.filter((b) =>
                b.label.toLowerCase().includes(search.toLowerCase()) ||
                b.description.toLowerCase().includes(search.toLowerCase())
              )
            : blocks

          if (filtered.length === 0) return null
          const color = CATEGORY_COLORS[cat]

          return (
            <div key={cat}>
              <p
                className="text-[10px] font-syne font-bold px-2 mb-1.5 tracking-wider"
                style={{ color }}
              >
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="space-y-0.5">
                {filtered.map((block) => (
                  <div
                    key={block.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, block.type)}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-[8px] cursor-grab active:cursor-grabbing',
                      'hover:bg-surface transition-colors group'
                    )}
                  >
                    <div
                      className="w-7 h-7 rounded-[7px] flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: color + '20' }}
                    >
                      {block.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-syne font-semibold text-text truncate">
                        {block.label}
                      </p>
                      <p className="text-[10px] text-text3 truncate leading-tight">
                        {block.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
