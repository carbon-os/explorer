import {
  MdFolder, MdImage, MdVideoFile, MdAudioFile,
  MdPictureAsPdf, MdCode, MdFolderZip,
  MdTextSnippet, MdApps, MdInsertDriveFile,
} from 'react-icons/md'
import { FileEntry } from '../types'
import { getCategory, FileCategory } from '../utils'

const STYLES: Record<FileCategory, { Icon: any; color: string }> = {
  folder:     { Icon: MdFolder,          color: '#555555' },
  image:      { Icon: MdImage,           color: '#555555' },
  video:      { Icon: MdVideoFile,       color: '#555555' },
  audio:      { Icon: MdAudioFile,       color: '#555555' },
  pdf:        { Icon: MdPictureAsPdf,    color: '#555555' },
  code:       { Icon: MdCode,            color: '#555555' },
  archive:    { Icon: MdFolderZip,       color: '#555555' },
  text:       { Icon: MdTextSnippet,     color: '#555555' },
  executable: { Icon: MdApps,            color: '#555555' },
  file:       { Icon: MdInsertDriveFile, color: '#aaaaaa' },
}

interface Props { entry: FileEntry; size?: number }

export default function FileIcon({ entry, size = 48 }: Props) {
  const { Icon, color } = STYLES[getCategory(entry)]
  return <Icon size={size} color={color} style={{ flexShrink: 0 }} />
}