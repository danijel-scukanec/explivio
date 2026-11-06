import * as React from 'react'

import { cn } from '@/lib/utils'

// A stacked labeled form field: a label text above its control. Replaces the legacy
// `<label>text <input/></label>` pattern the modals used. Wrap any control (Input, Textarea,
// select, PlaceSearchInput, …) as children.
function Field({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<'label'> & { label: React.ReactNode }) {
  return (
    <label
      data-slot="field"
      className={cn('text-foreground flex flex-col gap-1.5 text-left text-sm font-medium', className)}
      {...props}
    >
      {label && <span>{label}</span>}
      {children}
    </label>
  )
}

export { Field }
