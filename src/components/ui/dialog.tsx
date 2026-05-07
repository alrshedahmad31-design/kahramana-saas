import * as React from "react"

const Dialog = ({ children, open, onOpenChange }: { 
  children: React.ReactNode, 
  open?: boolean, 
  onOpenChange?: (open: boolean) => void 
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = onOpenChange
  return <>{open ? children : null}</>
}

const DialogTrigger = ({ asChild, children, onClick }: { asChild?: boolean, children: React.ReactNode, onClick?: () => void }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = asChild
  return <div onClick={onClick} className="cursor-pointer inline-block">{children}</div>
}

const DialogContent = ({ className, children }: { className?: string, children: React.ReactNode }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-background border rounded-lg shadow-lg w-full max-w-lg animate-in fade-in zoom-in duration-200 p-6 ${className || ""}`}>
        {children}
      </div>
    </div>
  )
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-start ${className || ""}`} {...props} />
)

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ""}`} {...props} />
)

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={`text-lg font-semibold leading-none tracking-tight ${className || ""}`}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-muted-foreground ${className || ""}`}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
