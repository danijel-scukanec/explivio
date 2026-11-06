import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names, resolving Tailwind conflicts (last wins). Used by every shadcn/ui component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
