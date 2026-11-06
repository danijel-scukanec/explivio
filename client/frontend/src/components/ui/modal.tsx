import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

// Shared modal shell: fixed overlay (click outside closes), centered panel capped to the viewport
// height with the header pinned and the body scrolling. Replaces the legacy `.modal-overlay`/`.modal`
// CSS the feature modals shared. The caller supplies the body (and its own sticky action row).
function Modal({
  title,
  onClose,
  className,
  children,
}: {
  title: React.ReactNode
  onClose: () => void
  className?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={cn(
          'bg-background flex max-h-[calc(100vh-2rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-xl border shadow-lg',
          className,
        )}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-foreground text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded px-2 py-1 text-base"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// A scrollable modal body (fields area) — flex column that grows and scrolls.
function ModalBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-5 pb-6', className)}
      {...props}
    />
  )
}

// A right-aligned action row pinned to the bottom of the panel.
function ModalActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('bg-background flex justify-end gap-2 border-t px-6 py-3', className)}
      {...props}
    />
  )
}

export { Modal, ModalBody, ModalActions }
