import * as React from 'react'

import { cn } from '@/lib/utils'

// A lightweight dropdown menu (no Radix dependency): closes on outside-click, Escape, or when an item
// is chosen. `trigger` is rendered as-is and toggles the menu on click.
function Menu({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            'bg-popover absolute top-[calc(100%+6px)] z-50 min-w-48 overflow-hidden rounded-lg border p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function MenuItem({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'text-popover-foreground hover:bg-accent flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function MenuSeparator({ className }: { className?: string }) {
  return <div className={cn('bg-border -mx-1 my-1 h-px', className)} />
}

export { Menu, MenuItem, MenuSeparator }
