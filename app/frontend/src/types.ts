export type ViewMode  = 'grid' | 'list'
export type SortField = 'name' | 'size' | 'type' | 'modified'
export type SortDir   = 'asc'  | 'desc'

export interface FileEntry {
  name:     string
  path:     string
  isDir:    boolean
  size:     number   // bytes; 0 for dirs
  modified: number   // unix ms
  ext:      string   // lowercase, no dot
}

export interface DriveInfo {
  label:       string
  path:        string
  totalBytes?: number
  freeBytes?:  number
  removable?:  boolean
}

export interface SpecialDirs {
  home:       string
  desktop?:   string
  documents?: string
  downloads?: string
  pictures?:  string
  music?:     string
  videos?:    string
}

export interface ClipboardData {
  paths: string[]
  op:    'copy' | 'cut'
}

export interface CtxMenuState {
  x:          number
  y:          number
  targets:    string[]
  background: boolean   // right-clicked on empty space
}