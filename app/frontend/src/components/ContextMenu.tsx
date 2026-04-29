import { useEffect, useRef } from 'react'
import {
  MdOpenInNew, MdContentCut, MdContentCopy, MdContentPaste,
  MdDriveFileRenameOutline, MdDeleteOutline,
  MdCreateNewFolder, MdInfo,
} from 'react-icons/md'
import { CtxMenuState } from '../types'

interface Props {
  menu:        CtxMenuState
  canPaste:    boolean
  onOpen:      () => void
  onCut:       () => void
  onCopy:      () => void
  onPaste:     () => void
  onRename:    () => void
  onDelete:    () => void
  onNewFolder: () => void
  onGetInfo:   () => void
  onClose:     () => void
}

export default function ContextMenu({
  menu, canPaste,
  onOpen, onCut, onCopy, onPaste,
  onRename, onDelete, onNewFolder, onGetInfo, onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function down(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown',   key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown',   key)
    }
  }, [onClose])

  const vw     = window.innerWidth
  const vh     = window.innerHeight
  const x      = Math.min(menu.x, vw - 218)
  const y      = Math.min(menu.y, vh - 308)
  const has    = menu.targets.length > 0
  const multi  = menu.targets.length > 1

  function item(
    icon: React.ReactNode, label: string, action: () => void,
    disabled = false, danger = false,
  ) {
    return (
      <div
        className={`ctx-item${disabled ? ' disabled' : ''}${danger ? ' danger' : ''}`}
        onMouseDown={e => {
          e.stopPropagation()
          if (!disabled) { action(); onClose() }
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
    )
  }

  return (
    <div ref={ref} className="ctx-menu" style={{ left: x, top: y }}>
      {has && !multi && item(<MdOpenInNew size={16} />, 'Open', onOpen)}
      {has  && item(<MdContentCut  size={16} />, 'Cut',  onCut)}
      {has  && item(<MdContentCopy size={16} />, 'Copy', onCopy)}
      {item(<MdContentPaste size={16} />, 'Paste', onPaste, !canPaste)}
      <div className="ctx-sep" />
      {has && !multi && item(<MdDriveFileRenameOutline size={16} />, 'Rename', onRename)}
      {has  && item(<MdDeleteOutline size={16} />, 'Move to Trash', onDelete, false, true)}
      <div className="ctx-sep" />
      {item(<MdCreateNewFolder size={16} />, 'New Folder', onNewFolder)}
      {has && !multi && (
        <>
          <div className="ctx-sep" />
          {item(<MdInfo size={16} />, 'Get Info', onGetInfo)}
        </>
      )}
    </div>
  )
}