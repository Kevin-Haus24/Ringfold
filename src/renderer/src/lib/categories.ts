import type { Lang } from '../../../shared/types'

export type Category =
  | 'video'
  | 'image'
  | 'audio'
  | 'archive'
  | 'document'
  | 'code'
  | 'app'
  | 'diskimage'
  | 'game'
  | 'system'
  | 'other'

const EXTENSIONS: Record<Exclude<Category, 'other'>, string> = {
  video: 'mp4 mkv avi mov wmv flv webm m4v mpg mpeg m2ts mts ts 3gp vob ogv prproj',
  image: 'jpg jpeg png gif bmp tif tiff webp heic heif raw cr2 cr3 nef arw dng orf rw2 svg ico psd psb xcf kra ai eps exr hdr avif jxl',
  audio: 'mp3 wav flac aac ogg oga m4a wma opus aiff aif alac mid midi ape',
  archive: '7z zip rar tar gz tgz bz2 xz zst lz4 lzma cab arj z tbz2 txz',
  document: 'pdf doc docx xls xlsx ppt pptx odt ods odp rtf txt md epub djvu fb2 mobi csv tex pages numbers key one',
  code: 'js mjs cjs ts tsx jsx json py rs go c h cpp hpp cc cs java kt swift rb php html css scss less vue svelte lua sh ps1 bat sql yml yaml toml xml ipynb gradle class o obj pdb lib a jar pyc wasm map',
  app: 'exe dll msi msix appx sys so dylib app apk aab deb rpm pkg appimage snap flatpak bin com node',
  diskimage: 'iso img vhd vhdx vmdk vdi qcow2 dmg wim esd swm hds',
  game: 'pak vpk bsa ba2 forge uasset ucas utoc umap wad gcf ncch xci nsp rpf big pbo bundle assets resource sav',
  system: 'log tmp temp cache dat db sqlite sqlite3 ldb bak old dmp etl evtx msp blf regtrans-ms lock idx'
}

const LOOKUP = new Map<string, Category>()
for (const [cat, list] of Object.entries(EXTENSIONS)) {
  for (const ext of list.split(' ')) LOOKUP.set(ext, cat as Category)
}

export function categoryOfExt(ext: string): Category {
  return LOOKUP.get(ext) ?? 'other'
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : ''
}

export const categoryOf = (name: string): Category => categoryOfExt(extOf(name))

export const CATEGORIES: Record<Category, { color: string; label: Record<Lang, string> }> = {
  video: { color: '#ff6b8b', label: { ru: 'Видео', en: 'Video' } },
  image: { color: '#ffb547', label: { ru: 'Изображения', en: 'Images' } },
  audio: { color: '#c77dff', label: { ru: 'Аудио', en: 'Audio' } },
  archive: { color: '#ff8a4c', label: { ru: 'Архивы', en: 'Archives' } },
  document: { color: '#4fc3f7', label: { ru: 'Документы', en: 'Documents' } },
  code: { color: '#5ee6a8', label: { ru: 'Код и разработка', en: 'Code & dev' } },
  app: { color: '#7c8cff', label: { ru: 'Программы', en: 'Applications' } },
  diskimage: { color: '#f06bd6', label: { ru: 'Образы дисков', en: 'Disk images' } },
  game: { color: '#a3e635', label: { ru: 'Игровые данные', en: 'Game data' } },
  system: { color: '#94a3b8', label: { ru: 'Системные и кэш', en: 'System & cache' } },
  other: { color: '#6b7280', label: { ru: 'Прочее', en: 'Other' } }
}
