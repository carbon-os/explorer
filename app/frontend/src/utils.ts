import { FileEntry } from './types'

export type FileCategory =
  | 'folder' | 'image' | 'video' | 'audio' | 'pdf'
  | 'code' | 'archive' | 'text' | 'executable' | 'file'

const EXT: Record<string, FileCategory> = {
  jpg:'image', jpeg:'image', png:'image', gif:'image', webp:'image',
  svg:'image', bmp:'image', ico:'image', tiff:'image', heic:'image', avif:'image',
  mp4:'video', mkv:'video', avi:'video', mov:'video',
  wmv:'video', flv:'video', webm:'video', m4v:'video',
  mp3:'audio', wav:'audio', ogg:'audio', flac:'audio',
  aac:'audio', m4a:'audio', wma:'audio', opus:'audio',
  pdf:'pdf',
  js:'code',  jsx:'code', ts:'code',  tsx:'code',
  py:'code',  go:'code',  rs:'code',  cpp:'code',
  c:'code',   h:'code',   cs:'code',  java:'code',
  css:'code', html:'code',htm:'code', json:'code',
  xml:'code', yaml:'code',yml:'code', sh:'code',
  toml:'code',lua:'code', rb:'code',  php:'code',
  swift:'code', kt:'code', dart:'code', vue:'code',
  zip:'archive', tar:'archive', gz:'archive',
  '7z':'archive', rar:'archive', bz2:'archive', tgz:'archive',
  txt:'text', md:'text', rtf:'text', csv:'text',
  doc:'text', docx:'text', odt:'text', xlsx:'text',
  exe:'executable', msi:'executable', dmg:'executable',
  deb:'executable', rpm:'executable', appimage:'executable',
}

export function getCategory(entry: FileEntry): FileCategory {
  if (entry.isDir) return 'folder'
  return EXT[entry.ext.toLowerCase()] ?? 'file'
}

export function fmtSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}

export function fmtModified(ts: number): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  if (diff < 60_000)      return 'Just now'
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 172_800_000) return 'Yesterday'
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(ts).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
}

export function fmtType(entry: FileEntry): string {
  if (entry.isDir) return 'Folder'
  if (!entry.ext)  return 'File'
  return entry.ext.toUpperCase() + ' file'
}

export function isWin(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path)
}

export function parentPath(path: string): string | null {
  if (isWin(path)) {
    const clean = path.replace(/\\$/, '')
    if (/^[A-Za-z]:$/.test(clean)) return null
    const idx = clean.lastIndexOf('\\')
    if (idx < 0) return null
    const parent = clean.slice(0, idx)
    return /^[A-Za-z]:$/.test(parent) ? parent + '\\' : parent
  }
  if (path === '/') return null
  const clean = path.replace(/\/$/, '')
  const idx = clean.lastIndexOf('/')
  if (idx === 0) return '/'
  return clean.slice(0, idx) || '/'
}

export function joinPath(base: string, name: string): string {
  const sep = isWin(base) ? '\\' : '/'
  return base.endsWith(sep) ? base + name : base + sep + name
}

export function pathParts(path: string): { label: string; path: string }[] {
  const parts: { label: string; path: string }[] = []
  if (isWin(path)) {
    const m = path.match(/^([A-Za-z]:\\)(.*)/)
    if (!m) return [{ label: path, path }]
    const drive = m[1]
    const rest  = m[2].replace(/\\+$/, '')
    parts.push({ label: drive, path: drive })
    let cur = drive.replace(/\\$/, '')
    if (rest) {
      for (const seg of rest.split('\\').filter(Boolean)) {
        cur = cur + '\\' + seg
        parts.push({ label: seg, path: cur })
      }
    }
  } else {
    parts.push({ label: '/', path: '/' })
    let cur = ''
    for (const seg of path.split('/').filter(Boolean)) {
      cur = cur + '/' + seg
      parts.push({ label: seg, path: cur })
    }
  }
  return parts
}

export function basename(path: string): string {
  return path.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? path
}

export function totalSize(entries: FileEntry[]): number {
  return entries.reduce((s, e) => s + e.size, 0)
}