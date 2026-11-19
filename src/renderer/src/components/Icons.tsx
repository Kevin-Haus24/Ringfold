import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 18, ...rest }: P, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Logo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7c8cff" />
        <stop offset="1" stopColor="#4fd1c5" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="5" fill="url(#lg)" />
    <path d="M16 4 A12 12 0 0 1 27.4 19.7" stroke="#7c8cff" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M25.2 23.6 A12 12 0 0 1 8.2 25.1" stroke="#4fd1c5" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M5.6 21.5 A12 12 0 0 1 12 4.7" stroke="#ff6b8b" strokeWidth="4" fill="none" strokeLinecap="round" />
  </svg>
)

export const FolderIcon = (p: P) =>
  base(p, <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2h7.4A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />)
export const FileIcon = (p: P) =>
  base(p, <><path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" /><path d="M14 3v5h5" /></>)
export const DriveIcon = (p: P) =>
  base(p, <><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M5 13l2.2-7.1A2 2 0 0 1 9.1 4.5h5.8a2 2 0 0 1 1.9 1.4L19 13" /><path d="M7 16.5h.01M10.5 16.5h.01" /></>)
export const HomeIcon = (p: P) =>
  base(p, <><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></>)
export const FolderSearchIcon = (p: P) =>
  base(p, <><path d="M11 20H5.5A2.5 2.5 0 0 1 3 17.5v-10A2.5 2.5 0 0 1 5.5 5h3.6l2 2h7.4A2.5 2.5 0 0 1 21 9.5v1.5" /><circle cx="17" cy="16" r="3" /><path d="m21 20-1.8-1.8" /></>)
export const RefreshIcon = (p: P) =>
  base(p, <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></>)
export const BackIcon = (p: P) => base(p, <path d="M15 18l-6-6 6-6" />)
export const ChevronIcon = (p: P) => base(p, <path d="M9 6l6 6-6 6" />)
export const TrashIcon = (p: P) =>
  base(p, <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>)
export const RevealIcon = (p: P) =>
  base(p, <><path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>)
export const CopyIcon = (p: P) =>
  base(p, <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>)
export const OpenIcon = (p: P) => base(p, <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>)
export const MoreIcon = (p: P) =>
  base(p, <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>)
export const SunIcon = (p: P) =>
  base(p, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>)
export const MoonIcon = (p: P) => base(p, <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />)
export const SystemIcon = (p: P) =>
  base(p, <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>)
export const ChartIcon = (p: P) =>
  base(p, <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>)
export const PieIcon = (p: P) =>
  base(p, <><path d="M4 6h16M4 12h10M4 18h6" /></>)
export const BigFileIcon = (p: P) =>
  base(p, <><path d="M6 20V10M12 20V4M18 20v-7" /></>)
export const DupesIcon = (p: P) =>
  base(p, <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></>)
