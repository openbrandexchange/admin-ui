import type { ReactNode } from 'react'

// A handful of 24px line icons (stroke = currentColor). Decorative unless given a title.

type IconProps = { size?: number; title?: string; className?: string }

function svg(paths: ReactNode, { size = 18, title, className }: IconProps) {
  return (
    <svg
      className={'shrink-0 ' + (className ?? '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {paths}
    </svg>
  )
}

export const IconDownload = (p: IconProps) => svg(<><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>, p)
export const IconUpload = (p: IconProps) => svg(<><path d="M12 20V9" /><path d="m7 14 5-5 5 5" /><path d="M5 4h14" /></>, p)
export const IconSearch = (p: IconProps) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>, p)
export const IconCheck = (p: IconProps) => svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, p)
export const IconX = (p: IconProps) => svg(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>, p)
export const IconPlus = (p: IconProps) => svg(<><path d="M12 5v14" /><path d="M5 12h14" /></>, p)
export const IconCopy = (p: IconProps) => svg(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>, p)
export const IconImage = (p: IconProps) => svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m20 16-4.5-4.5L7 20" /></>, p)
export const IconGrid = (p: IconProps) => svg(<><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>, p)
export const IconGridDense = (p: IconProps) => svg(<><path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z" /></>, p)
export const IconChevronDown = (p: IconProps) => svg(<path d="m6 9 6 6 6-6" />, p)
export const IconChevronLeft = (p: IconProps) => svg(<path d="m15 6-6 6 6 6" />, p)
export const IconArrowUp = (p: IconProps) => svg(<><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>, p)
export const IconArrowDown = (p: IconProps) => svg(<><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>, p)
export const IconTrash = (p: IconProps) => svg(<><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>, p)
export const IconExternal = (p: IconProps) => svg(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>, p)
export const IconBox = (p: IconProps) => svg(<><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4" /><path d="M12 12v8" /></>, p)
export const IconHome = (p: IconProps) => svg(<><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>, p)
export const IconUsers = (p: IconProps) => svg(<><circle cx="9" cy="9" r="3.5" /><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5" /><path d="M16 5.5a3 3 0 0 1 0 6M18 15c1.6.6 2.6 2.2 3 5" /></>, p)
export const IconBolt = (p: IconProps) => svg(<path d="M13 3 5 14h6l-1 7 8-11h-6z" />, p)
export const IconChart = (p: IconProps) => svg(<><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>, p)
export const IconCog = (p: IconProps) => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>, p)
export const IconList = (p: IconProps) => svg(<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>, p)
export const IconBarcode = (p: IconProps) => svg(<path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14" />, p)
export const IconUser = (p: IconProps) => svg(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1-3.8 4-5.6 7.5-5.6s6.5 1.8 7.5 5.6" /></>, p)
export const IconSparkle = (p: IconProps) => svg(<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 10.9 10.1 9z" />, p)
export const IconClock = (p: IconProps) => svg(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.8" /></>, p)
export const IconEye = (p: IconProps) => svg(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>, p)
export const IconMenu = (p: IconProps) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, p)
export const IconGlobe = (p: IconProps) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z" /></>, p)
export const IconLogout = (p: IconProps) => svg(<><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4" /><path d="M6 12h10" /></>, p)
export const IconKey = (p: IconProps) => svg(<><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" /></>, p)
export const IconInbox = (p: IconProps) => svg(<><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M5 6h14l1 7v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z" /></>, p)
export const IconFile = (p: IconProps) => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>, p)
