import { useState, useRef, useEffect } from 'react'
import {
  MdArrowBack, MdArrowForward, MdArrowUpward,
  MdSearch, MdClose, MdViewModule, MdViewList,
  MdRefresh, MdSort, MdCreateNewFolder,
} from 'react-icons/md'
import { ViewMode, SortField, SortDir } from '../types'
import { pathParts } from '../utils'

interface Props {
  currentPath: string
  canBack:     boolean
  canForward:  boolean
  canUp:       boolean
  viewMode:    ViewMode
  sortField:   SortField
  sortDir:     SortDir
  searchQuery: string
  onBack:      () => void
  onForward:   () => void
  onUp:        () => void
  onNavigate:  (path: string) => void
  onRefresh:   () => void
  onViewMode:  (m: ViewMode) => void
  onSort:      (field: SortField, dir: SortDir) => void
  onSearch:    (q: string) => void
  onNewFolder: () => void
}

export default function Toolbar({
  currentPath, canBack, canForward, canUp,
  viewMode, sortField, sortDir, searchQuery,
  onBack, onForward, onUp, onNavigate, onRefresh,
  onViewMode, onSort, onSearch, onNewFolder,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortOpen,   setSortOpen]   = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const sortRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (!sortOpen) return
    function down(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [sortOpen])

  const parts = pathParts(currentPath)

  const SORT_OPTIONS: { label: string; field: SortField; dir: SortDir }[] = [
    { label: 'Name (A–Z)',      field: 'name',     dir: 'asc'  },
    { label: 'Name (Z–A)',      field: 'name',     dir: 'desc' },
    { label: 'Date (newest)',   field: 'modified', dir: 'desc' },
    { label: 'Date (oldest)',   field: 'modified', dir: 'asc'  },
    { label: 'Size (largest)',  field: 'size',     dir: 'desc' },
    { label: 'Size (smallest)', field: 'size',     dir: 'asc'  },
    { label: 'Type',            field: 'type',     dir: 'asc'  },
  ]

  return (
    <div style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '0 8px',
      borderBottom: '1px solid #e8e8e8',
      background: '#fff',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Nav buttons */}
      <button className="tb-btn" onClick={onBack}    disabled={!canBack}    title="Back">
        <MdArrowBack size={18} />
      </button>
      <button className="tb-btn" onClick={onForward} disabled={!canForward} title="Forward">
        <MdArrowForward size={18} />
      </button>
      <button className="tb-btn" onClick={onUp}      disabled={!canUp}      title="Up">
        <MdArrowUpward size={18} />
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: '#e8e8e8', margin: '0 4px', flexShrink: 0 }} />

      {/* Breadcrumb */}
      {!searchOpen && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          overflow: 'hidden',
          padding: '0 2px',
          minWidth: 0,
        }}>
          {parts.map((part: { label: string; path: string }, i: number) => {
            const isLast = i === parts.length - 1
            return (
              <div key={part.path} style={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                {i > 0 && (
                  <span style={{ color: '#ccc', fontSize: 13, flexShrink: 0, padding: '0 1px' }}>
                    /
                  </span>
                )}
                <button
                  onClick={() => !isLast && onNavigate(part.path)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '3px 5px',
                    borderRadius: 4,
                    cursor: isLast ? 'default' : 'pointer',
                    fontSize: 13,
                    color: isLast ? '#111' : '#888',
                    fontWeight: isLast ? 500 : 400,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: i === 0 ? 80 : 160,
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => { if (!isLast) (e.currentTarget as HTMLElement).style.color = '#111' }}
                  onMouseLeave={e => { if (!isLast) (e.currentTarget as HTMLElement).style.color = '#888' }}
                >
                  {part.label}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Search input */}
      {searchOpen && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          background: '#f0f0f0',
          borderRadius: 20,
          padding: '0 10px',
          gap: 6,
          height: 32,
        }}>
          <MdSearch size={16} color="#999" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search files…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: '#111',
              fontFamily: 'inherit',
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { onSearch(''); setSearchOpen(false) }
            }}
          />
          {searchQuery && (
            <button className="tb-btn" style={{ width: 20, height: 20 }}
              onClick={() => onSearch('')}>
              <MdClose size={14} />
            </button>
          )}
        </div>
      )}

      {/* Right-side actions */}
      <button
        className={`tb-btn${searchOpen ? ' active' : ''}`}
        onClick={() => { setSearchOpen(o => !o); if (searchOpen) onSearch('') }}
        title="Search"
      >
        <MdSearch size={18} />
      </button>

      <button className="tb-btn" onClick={onRefresh}   title="Refresh">
        <MdRefresh size={18} />
      </button>
      <button className="tb-btn" onClick={onNewFolder} title="New folder">
        <MdCreateNewFolder size={18} />
      </button>

      {/* View toggle */}
      <div style={{
        display: 'flex',
        background: '#f0f0f0',
        borderRadius: 7,
        padding: 2,
        gap: 1,
        flexShrink: 0,
      }}>
        {(['grid', 'list'] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => onViewMode(m)}
            style={{
              background: viewMode === m ? '#111' : 'transparent',
              border: 'none',
              borderRadius: 5,
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: viewMode === m ? '#fff' : '#888',
              transition: 'all 0.12s',
            }}
          >
            {m === 'grid' ? <MdViewModule size={16} /> : <MdViewList size={16} />}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <div ref={sortRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className={`tb-btn${sortOpen ? ' active' : ''}`}
          onClick={() => setSortOpen(o => !o)}
          title="Sort"
        >
          <MdSort size={18} />
        </button>
        {sortOpen && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            background: '#fff',
            borderRadius: 8,
            minWidth: 190,
            boxShadow: '0 0 0 1px #e8e8e8, 0 8px 24px rgba(0,0,0,0.10)',
            padding: '4px 0',
            zIndex: 9999,
          }}>
            {SORT_OPTIONS.map(opt => {
              const active = sortField === opt.field && sortDir === opt.dir
              return (
                <div
                  key={opt.label}
                  onClick={() => { onSort(opt.field, opt.dir); setSortOpen(false) }}
                  style={{
                    padding: '7px 14px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: active ? '#f0f0f0' : 'transparent',
                    color: active ? '#111' : '#555',
                    fontWeight: active ? 600 : 400,
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = '#f7f7f7'
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  {opt.label}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}