// Thin pass-through to sonner. Kept as a named module so every call site
// (~10 files at last count) can stay on `import { toast } from '@/lib/toast'`
// — if we ever swap libraries again, this is the single point of change.
import { toast as sonnerToast } from 'sonner'

export const toast = {
  success: (msg: string) => sonnerToast.success(msg),
  error:   (msg: string) => sonnerToast.error(msg),
  info:    (msg: string) => sonnerToast.info(msg),
  warning: (msg: string) => sonnerToast.warning(msg),
}
