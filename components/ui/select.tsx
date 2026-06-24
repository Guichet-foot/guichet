"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string | null) => void
  children?: React.ReactNode
  required?: boolean
}

interface SelectContextType {
  value?: string
  onChange: (value: string) => void
  placeholder: string
  setPlaceholder: (p: string) => void
  options: { value: string; label: string }[]
  addOption: (value: string, label: string) => void
  clearOptions: () => void
}

const SelectContext = React.createContext<SelectContextType>({
  onChange: () => {},
  placeholder: "",
  setPlaceholder: () => {},
  options: [],
  addOption: () => {},
  clearOptions: () => {},
})

function Select({ value, defaultValue, onValueChange, children, required }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const [placeholder, setPlaceholder] = React.useState("")
  const [options, setOptions] = React.useState<{ value: string; label: string }[]>([])
  const currentValue = value !== undefined ? value : internalValue

  const addOption = React.useCallback((val: string, label: string) => {
    setOptions(prev => {
      if (prev.some(o => o.value === val)) return prev
      return [...prev, { value: val, label }]
    })
  }, [])

  const clearOptions = React.useCallback(() => {
    setOptions([])
  }, [])

  function handleChange(newValue: string) {
    setInternalValue(newValue)
    onValueChange?.(newValue || null)
  }

  return (
    <SelectContext.Provider value={{
      value: currentValue,
      onChange: handleChange,
      placeholder,
      setPlaceholder,
      options,
      addOption,
      clearOptions,
    }}>
      <SelectInner required={required}>
        {children}
      </SelectInner>
    </SelectContext.Provider>
  )
}

function SelectInner({ children, required }: { children?: React.ReactNode; required?: boolean }) {
  const { value, onChange, placeholder, options } = React.useContext(SelectContext)

  return (
    <div className="relative">
      <select
        data-slot="select"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent py-2 pr-8 pl-2.5 text-sm transition-colors outline-none appearance-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <div className="hidden">{children}</div>
    </div>
  )
}

function SelectTrigger({ children, ...props }: any) {
  return <>{children}</>
}

function SelectValue({ placeholder }: { placeholder?: string; className?: string }) {
  const ctx = React.useContext(SelectContext)
  React.useEffect(() => {
    if (placeholder) ctx.setPlaceholder(placeholder)
  }, [placeholder])
  return null
}

function SelectContent({ children, ...props }: any) {
  const ctx = React.useContext(SelectContext)
  React.useEffect(() => {
    ctx.clearOptions()
  }, [])
  return <>{children}</>
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(SelectContext)
  const label = typeof children === "string" ? children : String(children)
  React.useEffect(() => {
    ctx.addOption(value, label)
  }, [value, label])
  return null
}

function SelectGroup({ children }: any) { return <>{children}</> }
function SelectLabel(props: any) { return null }
function SelectSeparator(props: any) { return null }
function SelectScrollUpButton(props: any) { return null }
function SelectScrollDownButton(props: any) { return null }

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
