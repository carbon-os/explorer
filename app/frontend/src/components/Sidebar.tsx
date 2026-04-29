import { useState } from 'react'
import {
  MdAccessTime, MdDesktopWindows, MdDownload,
  MdDescription, MdPhoto, MdMusicNote, MdVideoLibrary,
  MdStorage, MdDelete, MdComputer,
  MdExpandMore, MdChevronRight,
} from 'react-icons/md'
import { DriveInfo, SpecialDirs } from '../types'
import { fmtSize } from '../utils'

interface Props {
  currentPath: string
  specialDirs: SpecialDirs | null
  drives:      DriveInfo[]
  onNavigate:  (path: string) => void
  width:       number
}

interface NavItem { label: string; path: string; Icon: any }

export default function Sidebar({ currentPath, specialDirs, drives, onNavigate, width }: Props) {
  const [drivesOpen, setDrivesOpen] = useState(true)

  const quickItems: NavItem[] = [
    { label: 'Recent',    path: '__recent__',                  Icon: MdAccessTime     },
    { label: 'Desktop',   path: specialDirs?.desktop   ?? '', Icon: MdDesktopWindows },
    { label: 'Downloads', path: specialDirs?.downloads ?? '', Icon: MdDownload       },
    { label: 'Documents', path: specialDirs?.documents ?? '', Icon: MdDescription    },
    { label: 'Pictures',  path: specialDirs?.pictures  ?? '', Icon: MdPhoto          },
    { label: 'Music',     path: specialDirs?.music     ?? '', Icon: MdMusicNote      },
    { label: 'Videos',    path: specialDirs?.videos    ?? '', Icon: MdVideoLibrary   },
  ].filter(i => i.path)

  function NavRow({ item }: { item: NavItem }) {
    const active = currentPath === item.path
    return (
      <div
        className={`nav-item${active ? ' active' : ''}`}
        onClick={() => item.path && onNavigate(item.path)}
      >
        <item.Icon size={16} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
      </div>
    )
  }

  return (
    <div style={{
      width,
      flexShrink: 0,
      height: '100%',
      background: '#fafafa',
      borderRight: '1px solid #e8e8e8',
      overflowY: 'auto',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 12,
      paddingBottom: 12,
    }}>
      <Section label="Quick Access" />
      {quickItems.map(i => <NavRow key={i.path} item={i} />)}

      <Divider />

      <Section label="My Files" />
      {specialDirs?.home && (
        <NavRow item={{ label: 'Home', path: specialDirs.home, Icon: MdComputer }} />
      )}

      <Divider />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 16px 4px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setDrivesOpen(o => !o)}
      >
        {drivesOpen
          ? <MdExpandMore size={14} color="#999" />
          : <MdChevronRight size={14} color="#999" />}
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#999',
        }}>
          Devices
        </span>
      </div>

      {drivesOpen && drives.map(drive => (
        <div
          key={drive.path}
          className={`nav-item${currentPath === drive.path ? ' active' : ''}`}
          onClick={() => onNavigate(drive.path)}
        >
          <MdStorage size={16} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {drive.label}
            </div>
            {drive.totalBytes && drive.freeBytes !== undefined && (
              <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>
                {fmtSize(drive.freeBytes)} free
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={{ flex: 1, minHeight: 16 }} />
      <Divider />
      <NavRow item={{ label: 'Trash', path: '__trash__', Icon: MdDelete }} />
    </div>
  )
}

function Section({ label }: { label: string }) {
  return (
    <div style={{
      padding: '6px 16px 4px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: '#999',
    }}>
      {label}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#e8e8e8', margin: '6px 0' }} />
}