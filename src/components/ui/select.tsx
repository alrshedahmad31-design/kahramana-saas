import * as React from "react"

interface SelectProps {
  children: React.ReactNode
  onValueChange?: (value: string) => void
  value?: string
}

const Select = ({ children, onValueChange, value }: SelectProps) => {
  return (
    <div className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ onValueChange?: (value: string) => void; value?: string }>, { onValueChange, value })
        }
        return child
      })}
    </div>
  )
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children: React.ReactNode
}

const SelectTrigger = ({ className, children, ...props }: SelectTriggerProps) => {
  return (
    <div className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`} {...props}>
      {children}
    </div>
  )
}

interface SelectValueProps {
  placeholder?: string
  value?: string
}

const SelectValue = ({ placeholder, value }: SelectValueProps) => {
  return <span>{value || placeholder}</span>
}

interface SelectContentProps {
  children: React.ReactNode
  onValueChange?: (value: string) => void
  value?: string
}

const SelectContent = ({ children, onValueChange, value }: SelectContentProps) => {
  return (
    <select 
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

const SelectItem = ({ value, children }: SelectItemProps) => {
  return <option value={value}>{children}</option>
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}
