import { useEffect, useRef, useState } from 'react'
import { FileEntry, ViewMode, SortField, SortDir, CtxMenuState } from '../types'
import { fmtSize, fmtModified, fmtType } from '../utils'
import FileIcon from './FileIcon'

interface Props {
  entries:        FileEntry[]
  selected:       Set<string>
  viewMode:       ViewMode
  sortField:      SortField
  sortDir:        SortDir
  searchQuery:    string
  renaming:       string | null
  onSelect:       (paths: string[], mode: 'replace' | 'toggle' | 'range') => void
  onOpen:         (entry: FileEntry) => void
  onContextMenu:  (state: CtxMenuState) => void
  onRenameCommit: (path: string, newName: string) => void
  onRenameCancel: () => void
}

export default function FilePane({
  entries, selected, viewMode, sortField, sortDir,
  searchQuery, renaming,
  onSelect, onOpen, onContextMenu, onRenameCommit, onRenameCancel,
}: Props) {
  const lastClickRef = useRef<string | null>(null)

  const q        = searchQuery.toLowerCase()
  const filtered = q ? entries.filter(e => e.name.toLowerCase().includes(q)) : entries

  const sorted = [...filtered].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    let cmp = 0
    if      (sortField === 'name')     cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
    else if (sortField === 'size')     cmp = a.size - b.size
    else if (sortField === 'modified') cmp = a.modified - b.modified
    else if (sortField === 'type')     cmp = fmtType(a).localeCompare(fmtType(b))
    return sortDir === 'asc' ? cmp : -cmp
  })

  function handleClick(e: React.MouseEvent, path: string) {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      onSelect([path], 'toggle')
    } else if (e.shiftKey && lastClickRef.current) {
      const paths   = sorted.map(en => en.path)
      const fromIdx = paths.indexOf(lastClickRef.current)
      const toIdx   = paths.indexOf(path)
      if (fromIdx >= 0 && toIdx >= 0) {
        const lo = Math.min(fromIdx, toIdx)
        const hi = Math.max(fromIdx, toIdx)
        onSelect(paths.slice(lo, hi + 1), 'replace')
        return
      }
      onSelect([path], 'replace')
    } else {
      onSelect([path], 'replace')
    }
    lastClickRef.current = path
  }

  function handleCtx(e: React.MouseEvent, entry?: FileEntry) {
    e.preventDefault()
    e.stopPropagation()
    const targets = entry
      ? (selected.has(entry.path) ? [...selected] : [entry.path])
      : []
    onContextMenu({ x: e.clientX, y: e.clientY, targets, background: !entry })
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: viewMode === 'grid' ? 16 : 0,
        background: '#fff',
      }}
      onClick={() => onSelect([], 'replace')}
      onContextMenu={e => handleCtx(e)}
    >
      {sorted.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 10,
          color: '#bbb',
          paddingBottom: 60,
        }}>
          <span style={{ fontSize: 36 }}>—</span>
          <span style={{ fontSize: 13 }}>
            {searchQuery ? 'No results' : 'Empty folder'}
          </span>
        </div>
      )}

      {viewMode === 'grid'
        ? <GridView sorted={sorted} selected={selected} renaming={renaming}
            onClick={handleClick} onOpen={onOpen} onCtx={handleCtx}
            onRenameCommit={onRenameCommit} onRenameCancel={onRenameCancel} />
        : <ListView sorted={sorted} selected={selected} renaming={renaming}
            onClick={handleClick} onOpen={onOpen} onCtx={handleCtx}
            onRenameCommit={onRenameCommit} onRenameCancel={onRenameCancel} />
      }
    </div>
  )
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function GridView({ sorted, selected, renaming, onClick, onOpen, onCtx, onRenameCommit, onRenameCancel }: any) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
      gap: 4,
    }}>
      {sorted.map((entry: FileEntry) => (
        <GridTile key={entry.path} entry={entry}
          selected={selected.has(entry.path)}
          renaming={renaming === entry.path}
          onClick={onClick} onOpen={onOpen} onCtx={onCtx}
          onRenameCommit={onRenameCommit} onRenameCancel={onRenameCancel}
        />
      ))}
    </div>
  )
}

function GridTile({ entry, selected, renaming, onClick, onOpen, onCtx, onRenameCommit, onRenameCancel }: any) {
  const [name, setName] = useState(entry.name)
  useEffect(() => { if (renaming) setName(entry.name) }, [renaming, entry.name])

  return (
    <div
      className={`file-tile${selected ? ' selected' : ''}`}
      onClick={e => onClick(e, entry.path)}
      onDoubleClick={() => onOpen(entry)}
      onContextMenu={e => onCtx(e, entry)}
    >
      <FileIcon entry={entry} size={40} />
      {renaming ? (
        <input
          className="rename-input"
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => onRenameCommit(entry.path, name)}
          onKeyDown={e => {
            if (e.key === 'Enter')  onRenameCommit(entry.path, name)
            if (e.key === 'Escape') onRenameCancel()
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span style={{
          fontSize: 11.5,
          color: '#222',
          textAlign: 'center',
          lineHeight: 1.3,
          maxHeight: 30,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
          width: '100%',
        }}>
          {entry.name}
        </span>
      )}
    </div>
  )
}

// ── List ──────────────────────────────────────────────────────────────────────

const COL: React.CSSProperties = {
  fontSize: 12,
  color: '#888',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function ListView({ sorted, selected, renaming, onClick, onOpen, onCtx, onRenameCommit, onRenameCancel }: any) {
  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 100px 130px',
        padding: '0 16px',
        height: 32,
        borderBottom: '1px solid #e8e8e8',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 2,
      }}>
        {['Name', 'Size', 'Type', 'Modified'].map(h => (
          <span key={h} style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#aaa',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {h}
          </span>
        ))}
      </div>

      {sorted.map((entry: FileEntry) => (
        <ListRow key={entry.path} entry={entry}
          selected={selected.has(entry.path)}
          renaming={renaming === entry.path}
          onClick={onClick} onOpen={onOpen} onCtx={onCtx}
          onRenameCommit={onRenameCommit} onRenameCancel={onRenameCancel}
        />
      ))}
    </div>
  )
}

function ListRow({ entry, selected, renaming, onClick, onOpen, onCtx, onRenameCommit, onRenameCancel }: any) {
  const [name, setName] = useState(entry.name)
  useEffect(() => { if (renaming) setName(entry.name) }, [renaming, entry.name])

  return (
    <div
      className={`file-row${selected ? ' selected' : ''}`}
      onClick={e => onClick(e, entry.path)}
      onDoubleClick={() => onOpen(entry)}
      onContextMenu={e => onCtx(e, entry)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <FileIcon entry={entry} size={18} />
        {renaming ? (
          <input
            className="rename-input"
            autoFocus
            value={name}
            style={{ textAlign: 'left', maxWidth: 260 }}
            onChange={e => setName(e.target.value)}
            onBlur={() => onRenameCommit(entry.path, name)}
            onKeyDown={e => {
              if (e.key === 'Enter')  onRenameCommit(entry.path, name)
              if (e.key === 'Escape') onRenameCancel()
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span style={{
            fontSize: 13,
            color: '#111',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entry.name}
          </span>
        )}
      </div>
      <span style={COL}>{entry.isDir ? '—' : fmtSize(entry.size)}</span>
      <span style={COL}>{fmtType(entry)}</span>
      <span style={COL}>{fmtModified(entry.modified)}</span>
    </div>
  )
}