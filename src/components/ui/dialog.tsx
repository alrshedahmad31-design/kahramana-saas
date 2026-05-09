'use client'

import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Dialog primitive (no Radix dependency).
//
// Previous version returned `null` when `open=false`, which hid the trigger
// entirely. The trigger MUST always be visible so users can open the dialog;
// only the modal content should mount/unmount based on `open`.
// ─────────────────────────────────────────────────────────────────────────────

interface DialogCtx {
  open:         boolean
  setOpen:      (next: boolean) => void
}

const DialogContext = React.createContext<DialogCtx | null>(null)

function useDialogContext(component: string): DialogCtx {
  const ctx = React.useContext(DialogContext)
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Dialog>`)
  }
  return ctx
}

const Dialog = ({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children:      React.ReactNode
  open?:         boolean
  onOpenChange?: (open: boolean) => void
}) => {
  const [uncontrolled, setUncontrolled] = React.useState(false)
  const isControlled = typeof controlledOpen === 'boolean'
  const open = isControlled ? controlledOpen! : uncontrolled

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  // Close on ESC; lock body scroll while open.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, setOpen])

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogTrigger = ({
  asChild,
  children,
  onClick,
}: {
  asChild?: boolean
  children: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
}) => {
  const { setOpen } = useDialogContext('DialogTrigger')

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onClick?: (e: React.MouseEvent) => void
    }>
    const childOnClick = child.props.onClick
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        childOnClick?.(e)
        onClick?.(e)
        if (!e.defaultPrevented) setOpen(true)
      },
    })
  }

  return (
    <button
      type="button"
      className="inline-block cursor-pointer"
      onClick={(e) => {
        onClick?.(e)
        setOpen(true)
      }}
    >
      {children}
    </button>
  )
}

const DialogContent = ({
  className,
  children,
  dir,
}: {
  className?: string
  children:   React.ReactNode
  dir?:       'rtl' | 'ltr'
}) => {
  const { open, setOpen } = useDialogContext('DialogContent')
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        dir={dir}
        className={`relative bg-brand-surface text-brand-text border border-brand-border rounded-lg shadow-2xl w-full max-w-lg p-6 ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-start ${className || ''}`} {...props} />
)

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`} {...props} />
)

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`}
      {...props}
    />
  ),
)
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className || ''}`} {...props} />
  ),
)
DialogDescription.displayName = 'DialogDescription'

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
