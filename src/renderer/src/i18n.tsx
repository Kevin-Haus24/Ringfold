import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { formatBytes } from '../../shared/format'
import type { Lang } from '../../shared/types'
import { storage } from './lib/util'

const ru = {
  appTagline: 'Куда уходит место на диске',
  homeTitle: 'Что будем исследовать?',
  homeSubtitle: 'Выберите диск или папку — Ringfold покажет, где и сколько занято места.',
  drives: 'Диски',
  home: 'Домашняя папка',
  chooseFolder: 'Выбрать папку…',
  chooseFolderHint: 'Любая папка на компьютере',
  freeOf: (free: string, total: string) => `${free} свободно из ${total}`,
  used: 'занято',
  scanning: 'Сканирование',
  scanFiles: 'Файлов',
  scanDirs: 'Папок',
  scanSize: 'Объём',
  scanTime: 'Время',
  scanErrors: (n: string) => `Нет доступа: ${n}`,
  cancel: 'Отмена',
  rescan: 'Пересканировать',
  newScan: 'Новое сканирование',
  language: 'Язык',
  theme: 'Тема',
  themeSystem: 'Системная',
  themeDark: 'Тёмная',
  themeLight: 'Светлая',
  tabOverview: 'Обзор',
  tabTypes: 'Типы файлов',
  tabTop: 'Крупные файлы',
  tabDupes: 'Дубликаты',
  statSize: 'Размер',
  statFiles: 'Файлов',
  statDirs: 'Папок',
  statScanned: 'Просканировано за',
  colName: 'Имя',
  colSize: 'Размер',
  colShare: 'Доля',
  colItems: 'Объектов',
  colModified: 'Изменён',
  colPath: 'Расположение',
  moreItems: (n: string, size: string) => `и ещё ${n} мелких объектов · ${size}`,
  otherItems: (n: string) => `${n} мелких объектов`,
  emptyFolder: 'Папка пуста',
  up: 'Вверх',
  ofParent: 'от текущей папки',
  clickToOpen: 'Нажмите, чтобы открыть',
  clickToGoUp: 'Нажмите, чтобы подняться',
  actOpen: 'Открыть',
  actReveal: (fm: string) => `Показать в ${fm}`,
  actCopy: 'Копировать путь',
  actTrash: 'Переместить в корзину',
  actBrowse: 'Перейти в папку',
  fmWin: 'Проводнике',
  fmMac: 'Finder',
  fmLinux: 'файловом менеджере',
  trashed: (size: string) => `Перемещено в корзину · освобождено ${size}`,
  trashFailed: (e: string) => `Не удалось удалить: ${e}`,
  copied: 'Путь скопирован',
  typesTitle: 'Чем занято место',
  typesSubtitle: 'Файлы сгруппированы по расширениям',
  extensions: 'Расширения',
  noExt: 'без расширения',
  filesCount: (n: string) => `${n} файлов`,
  topTitle: 'Самые крупные файлы',
  topSubtitle: (n: string) => `${n} крупнейших файлов в текущей папке и всех вложенных`,
  dupesTitle: 'Поиск дубликатов',
  dupesSubtitle: 'Одинаковые файлы сравниваются по содержимому, а не по имени.',
  dupesMin: 'Минимальный размер',
  dupesFind: 'Найти дубликаты',
  dupesAgain: 'Искать заново',
  dupesStage1: 'Быстрая проверка начала файлов',
  dupesStage2: 'Полное сравнение содержимого',
  dupesNone: 'Дубликатов не найдено',
  dupesSummary: (groups: string, wasted: string) => `${groups} групп дубликатов · можно освободить ${wasted}`,
  dupesGroup: (n: number, size: string) => `${n} копии по ${size}`,
  dupesWasted: (size: string) => `лишнее: ${size}`,
  dupesShown: (n: string) => `Показаны ${n} групп с наибольшей экономией`,
  loading: 'Загрузка…',
  errorTitle: 'Что-то пошло не так',
  back: 'Назад'
}

type Dict = typeof ru

const en: Dict = {
  appTagline: 'Where did my disk space go',
  homeTitle: 'What shall we explore?',
  homeSubtitle: 'Pick a drive or a folder — Ringfold shows where your space goes and how much.',
  drives: 'Drives',
  home: 'Home folder',
  chooseFolder: 'Choose folder…',
  chooseFolderHint: 'Any folder on this computer',
  freeOf: (free, total) => `${free} free of ${total}`,
  used: 'used',
  scanning: 'Scanning',
  scanFiles: 'Files',
  scanDirs: 'Folders',
  scanSize: 'Size',
  scanTime: 'Time',
  scanErrors: (n) => `Access denied: ${n}`,
  cancel: 'Cancel',
  rescan: 'Rescan',
  newScan: 'New scan',
  language: 'Language',
  theme: 'Theme',
  themeSystem: 'System',
  themeDark: 'Dark',
  themeLight: 'Light',
  tabOverview: 'Overview',
  tabTypes: 'File types',
  tabTop: 'Largest files',
  tabDupes: 'Duplicates',
  statSize: 'Size',
  statFiles: 'Files',
  statDirs: 'Folders',
  statScanned: 'Scanned in',
  colName: 'Name',
  colSize: 'Size',
  colShare: 'Share',
  colItems: 'Items',
  colModified: 'Modified',
  colPath: 'Location',
  moreItems: (n, size) => `and ${n} more small items · ${size}`,
  otherItems: (n) => `${n} small items`,
  emptyFolder: 'This folder is empty',
  up: 'Up',
  ofParent: 'of current folder',
  clickToOpen: 'Click to open',
  clickToGoUp: 'Click to go up',
  actOpen: 'Open',
  actReveal: (fm) => `Show in ${fm}`,
  actCopy: 'Copy path',
  actTrash: 'Move to Trash',
  actBrowse: 'Go to folder',
  fmWin: 'Explorer',
  fmMac: 'Finder',
  fmLinux: 'file manager',
  trashed: (size) => `Moved to trash · ${size} freed`,
  trashFailed: (e) => `Could not delete: ${e}`,
  copied: 'Path copied',
  typesTitle: 'What takes up space',
  typesSubtitle: 'Files grouped by extension',
  extensions: 'Extensions',
  noExt: 'no extension',
  filesCount: (n) => `${n} files`,
  topTitle: 'Largest files',
  topSubtitle: (n) => `The ${n} largest files in this folder and below`,
  dupesTitle: 'Find duplicates',
  dupesSubtitle: 'Files are compared by content, not by name.',
  dupesMin: 'Minimum size',
  dupesFind: 'Find duplicates',
  dupesAgain: 'Search again',
  dupesStage1: 'Quick check of file headers',
  dupesStage2: 'Full content comparison',
  dupesNone: 'No duplicates found',
  dupesSummary: (groups, wasted) => `${groups} duplicate groups · ${wasted} can be freed`,
  dupesGroup: (n, size) => `${n} copies of ${size}`,
  dupesWasted: (size) => `wasted: ${size}`,
  dupesShown: (n) => `Showing ${n} groups with the biggest savings`,
  loading: 'Loading…',
  errorTitle: 'Something went wrong',
  back: 'Back'
}

const DICTS: Record<Lang, Dict> = { ru, en }

interface I18n {
  lang: Lang
  t: Dict
  setLang(lang: Lang): void
  bytes(n: number): string
  num(n: number): string
  date(unixSeconds: number): string
  duration(ms: number): string
  fileManager: string
}

const Ctx = createContext<I18n | null>(null)

function initialLang(): Lang {
  const saved = storage.get('lang')
  if (saved === 'ru' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    storage.set('lang', l)
  }, [])

  const value = useMemo<I18n>(() => {
    const locale = lang === 'ru' ? 'ru-RU' : 'en-US'
    const t = DICTS[lang]
    const nf = new Intl.NumberFormat(locale)
    const df = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    const platform = window.api.platform
    document.documentElement.lang = lang
    return {
      lang,
      t,
      setLang,
      bytes: (n) => formatBytes(n, lang),
      num: (n) => nf.format(n),
      date: (s) => (s > 0 ? df.format(new Date(s * 1000)) : '—'),
      duration: (ms) => {
        const s = ms / 1000
        if (s < 60) return `${s.toLocaleString(locale, { maximumFractionDigits: 1 })} ${lang === 'ru' ? 'с' : 's'}`
        const m = Math.floor(s / 60)
        return `${m} ${lang === 'ru' ? 'мин' : 'min'} ${Math.round(s % 60)} ${lang === 'ru' ? 'с' : 's'}`
      },
      fileManager: platform === 'win32' ? t.fmWin : platform === 'darwin' ? t.fmMac : t.fmLinux
    }
  }, [lang, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside provider')
  return v
}
