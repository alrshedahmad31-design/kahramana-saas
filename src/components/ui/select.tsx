'use client'

import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Select primitive (no Radix dependency).
//
// Pattern: a styled <div> trigger sits underneath a transparent native <select>
// overlay. The native <select> handles all keyboard / mouse / a11y. Context
// carries `value` and `onValueChange` to descendants so we don't spread those
// React-only props onto a DOM element (the previous version did, producing
// "Unknown event handler property `onValueChange`").
// ─────────────────────────────────────────────────────────────────────────────

interface SelectCtx {
  value?:         string
  onValueChange?: (value: string) => void
}

const SelectContext = React.createContext<SelectCtx | null>(null)

interface SelectProps {
  children:      React.ReactNode
  onValueChange?: (value: string) => void
  value?:        string
}

const Select = ({ children, onValueChange, value }: SelectProps) => {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps {
  id?:        string
  className?: string
  children:   React.ReactNode
}

const SelectTrigger = ({ id, className, children }: SelectTriggerProps) => {
  return (
    <div
      id={id}
      className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
    >
      {children}
    </div>
  )
}

interface SelectValueProps {
  placeholder?: string
}

const SelectValue = ({ placeholder }: SelectValueProps) => {
  const ctx = React.useContext(SelectContext)
  return <span className="truncate">{ctx?.value || placeholder || ''}</span>
}

interface SelectContentProps {
  children: React.ReactNode
}

const SelectContent = ({ children }: SelectContentProps) => {
  const ctx = React.useContext(SelectContext)
  return (
    <select
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      value={ctx?.value ?? ''}
      onChange={(e) => ctx?.onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  )
}

interface SelectItemProps {
  value:    string
  children: React.ReactNode
}

// <option> elements can only contain text. Coerce non-string children into a
// string so callers passing icons/spans don't trip the "<span> cannot be a
// child of <option>" hydration error.
function flattenLabel(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenLabel).join('')
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode }
    return flattenLabel(props.children)
  }
  return ''
}

const SelectItem = ({ value, children }: SelectItemProps) => {
  return <option value={value}>{flattenLabel(children)}</option>
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
