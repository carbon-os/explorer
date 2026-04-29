import { useState, useEffect, useCallback, useRef } from 'react'
import { ipc } from './ipc/client'
import {
  FileEntry, DriveInfo, SpecialDirs,
  ViewMode, SortField, SortDir,
  ClipboardData, CtxMenuState,
} from './types'
import { parentPath, basename, fmtSize, totalSize } from './utils'
import Sidebar     from './components/Sidebar'
import Toolbar     from './components/Toolbar'
import FilePane    from './components/FilePane'
import ContextMenu from './components/ContextMenu'
import './App.css'

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 360
const SIDEBAR_DEF = 220

export default function App() {
  const [currentPath, setCurrentPath] = useState('')
  const [entries,     setEntries]     = useState<FileEntry[]>([])
  const [loading,     setLoading]     = useState(false)
  const [history,     setHistory]     = useState<string[]>([])
  const [histIdx,     setHistIdx]     = useState(-1)

  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [viewMode,     setViewMode]     = useState<ViewMode>('grid')
  const [sortField,    setSortField]    = useState<SortField>('name')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [renaming,     setRenaming]     = useState<string | null>(null)
  const [ctxMenu,      setCtxMenu]      = useState<CtxMenuState | null>(null)
  const [clipboard,    setClipboard]    = useState<ClipboardData | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEF)

  const [specialDirs, setSpecialDirs] = useState<SpecialDirs | null>(null)
  const [drives,      setDrives]      = useState<DriveInfo[]>([])

  const currentPathRef = useRef(currentPath)
  useEffect(() => { currentPathRef.current = currentPath }, [currentPath])

  useEffect(() => {
    const unsubList = ipc.on('fs.list.result', (data: any) => {
      if (data.path === currentPathRef.current) {
        setEntries(data.entries ?? [])
        setLoading(false)
      }
    })
    const unsubSpecial = ipc.on('fs.specialDirs.result', (data: SpecialDirs) => {
      setSpecialDirs(data)
      navigate(data.home)
    })
    const unsubDrives = ipc.on('fs.drives.result', (data: any) => {
      setDrives(data.drives ?? [])
    })
    const unsubOp = ipc.on('fs.op.result', (data: any) => {
      if (data.success) refresh()
    })

    ipc.send('fs.getSpecialDirs')
    ipc.send('fs.getDrives')

    return () => { unsubList(); unsubSpecial(); unsubDrives(); unsubOp() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigate = useCallback((path: string, addHistory = true) => {
    if (!path || path === '__recent__' || path === '__trash__') return
    setCurrentPath(path)
    setSelected(new Set())
    setSearchQuery('')
    setLoading(true)
    setRenaming(null)
    ipc.send('fs.list', { path })

    if (addHistory) {
      setHistory(prev => {
        const next = [...prev.slice(0, histIdx + 1), path]
        setHistIdx(next.length - 1)
        return next
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histIdx])

  function goBack() {
    if (histIdx <= 0) return
    const ni = histIdx - 1
    setHistIdx(ni)
    navigate(history[ni], false)
  }
  function goForward() {
    if (histIdx >= history.length - 1) return
    const ni = histIdx + 1
    setHistIdx(ni)
    navigate(history[ni], false)
  }
  function goUp() {
    const parent = parentPath(currentPath)
    if (parent) navigate(parent)
  }
  function refresh() {
    if (currentPath) ipc.send('fs.list', { path: currentPath })
  }

  function handleSelect(paths: string[], mode: 'replace' | 'toggle' | 'range') {
    setSelected(prev => {
      if (mode === 'replace') return new Set(paths)
      if (mode === 'toggle') {
        const next = new Set(prev)
        for (const p of paths) next.has(p) ? next.delete(p) : next.add(p)
        return next
      }
      return new Set(paths)
    })
  }

  function openEntry(entry: FileEntry) {
    if (entry.isDir) navigate(entry.path)
    else ipc.send('fs.open', { path: entry.path })
  }

  function deleteSelected() {
    if (!selected.size) return
    ipc.send('fs.delete', { paths: [...selected] })
    setSelected(new Set())
  }

  function startRename() {
    if (selected.size !== 1) return
    setRenaming([...selected][0])
  }

  function commitRename(path: string, newName: string) {
    if (newName.trim() && newName !== basename(path)) {
      ipc.send('fs.rename', { oldPath: path, newName: newName.trim() })
    }
    setRenaming(null)
  }

  function copySelected(op: 'copy' | 'cut') {
    if (!selected.size) return
    setClipboard({ paths: [...selected], op })
    if (op === 'cut') setSelected(new Set())
  }

  function paste() {
    if (!clipboard || !currentPath) return
    const channel = clipboard.op === 'copy' ? 'fs.copy' : 'fs.move'
    ipc.send(channel, { sources: clipboard.paths, dest: currentPath })
    if (clipboard.op === 'cut') setClipboard(null)
  }

  function newFolder() {
    ipc.send('fs.mkdir', { path: currentPath, name: 'New Folder' })
  }

  function ctxOpen() {
    const entry = entries.find(e => ctxMenu?.targets[0] === e.path)
    if (entry) openEntry(entry)
  }
  function ctxRename() {
    if (ctxMenu?.targets[0]) {
      setSelected(new Set([ctxMenu.targets[0]]))
      setRenaming(ctxMenu.targets[0])
    }
  }
  function ctxDelete() {
    if (!ctxMenu?.targets.length) return
    ipc.send('fs.delete', { paths: ctxMenu.targets })
    setSelected(new Set())
  }
  function ctxCut() {
    if (ctxMenu?.targets.length) {
      setClipboard({ paths: ctxMenu.targets, op: 'cut' })
      setSelected(new Set(ctxMenu.targets))
    }
  }
  function ctxCopy() {
    if (ctxMenu?.targets.length) {
      setClipboard({ paths: ctxMenu.targets, op: 'copy' })
      setSelected(new Set(ctxMenu.targets))
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        setSelected(new Set(entries.map(en => en.path)))
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') copySelected('copy')
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') copySelected('cut')
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') paste()
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      if (e.key === 'F2') startRename()
      if (e.key === 'F5') refresh()
      if (e.key === 'Escape') { setSelected(new Set()); setCtxMenu(null) }
      if (e.altKey && e.key === 'ArrowLeft')  goBack()
      if (e.altKey && e.key === 'ArrowRight') goForward()
      if (e.altKey && e.key === 'ArrowUp')    goUp()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, selected, clipboard, currentPath, histIdx, history])

  const resizing     = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  function onResizeMouseDown(e: React.MouseEvent) {
    resizing.current     = true
    resizeStartX.current = e.clientX
    resizeStartW.current = sidebarWidth
    e.preventDefault()
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizing.current) return
      const delta = e.clientX - resizeStartX.current
      setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, resizeStartW.current + delta)))
    }
    function onUp() { resizing.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  const selArray   = entries.filter(e => selected.has(e.path))
  const statusText = selected.size === 0
    ? `${entries.length} item${entries.length !== 1 ? 's' : ''}`
    : `${selected.size} selected — ${fmtSize(totalSize(selArray))}`

  return (
    <div style={{
      display:    'flex',
      width:      '100vw',
      height:     '100vh',
      overflow:   'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#fff',
      color:      '#111',
    }}>
      <Sidebar
        currentPath={currentPath}
        specialDirs={specialDirs}
        drives={drives}
        onNavigate={navigate}
        width={sidebarWidth}
      />

      <div className="resize-handle" onMouseDown={onResizeMouseDown} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Toolbar
          currentPath={currentPath}
          canBack={histIdx > 0}
          canForward={histIdx < history.length - 1}
          canUp={!!parentPath(currentPath)}
          viewMode={viewMode}
          sortField={sortField}
          sortDir={sortDir}
          searchQuery={searchQuery}
          onBack={goBack}
          onForward={goForward}
          onUp={goUp}
          onNavigate={navigate}
          onRefresh={refresh}
          onViewMode={setViewMode}
          onSort={(f, d) => { setSortField(f); setSortDir(d) }}
          onSearch={setSearchQuery}
          onNewFolder={newFolder}
        />

        {loading ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#bbb',
          }}>
            <span style={{ fontSize: 13 }}>Loading…</span>
          </div>
        ) : (
          <FilePane
            entries={entries}
            selected={selected}
            viewMode={viewMode}
            sortField={sortField}
            sortDir={sortDir}
            searchQuery={searchQuery}
            renaming={renaming}
            onSelect={handleSelect}
            onOpen={openEntry}
            onContextMenu={setCtxMenu}
            onRenameCommit={commitRename}
            onRenameCancel={() => setRenaming(null)}
          />
        )}

        {/* Status bar */}
        <div style={{
          height:      26,
          borderTop:   '1px solid #e8e8e8',
          display:     'flex',
          alignItems:  'center',
          padding:     '0 16px',
          fontSize:    11,
          color:       '#999',
          flexShrink:  0,
          userSelect:  'none',
          letterSpacing: '0.01em',
        }}>
          {statusText}
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          canPaste={!!clipboard}
          onOpen={ctxOpen}
          onCut={ctxCut}
          onCopy={ctxCopy}
          onPaste={paste}
          onRename={ctxRename}
          onDelete={ctxDelete}
          onNewFolder={newFolder}
          onGetInfo={() => {}}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}