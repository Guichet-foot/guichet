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

function extractOptions(children: React.ReactNode): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []

  function walk(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      if ((child.type as any)?.displayName === "SelectItem") {
        const props = child.props as any
        const label = typeof props.children === "string" ? props.children : String(props.children ?? props.value)
        options.push({ value: props.value, label })
      }
      if (props(child).children) {
        walk(props(child).children)
      }
    })
  }

  function props(el: React.ReactElement): any {
    return el.props || {}
  }

  walk(children)
  return options
}

function extractPlaceholder(children: React.ReactNode): string {
  let placeholder = ""

  function walk(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      if ((child.type as any)?.displayName === "SelectValue") {
        placeholder = (child.props as any).placeholder || ""
      }
      const p = (child as any).props
      if (p?.children) walk(p.children)
    })
  }

  walk(children)
  return placeholder
}

function Select({ value, defaultValue, onValueChange, children, required }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const currentValue = value !== undefined ? value : internalValue

  const options = extractOptions(children)
  const placeholder = extractPlaceholder(children)

  function handleChange(newValue: string) {
    setInternalValue(newValue)
    onValueChange?.(newValue || null)
  }

  return (
    <div className="relative">
      <select
        data-slot="select"
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
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
    </div>
  )
}

function SelectTrigger({ children }: any) { return <>{children}</> }

function SelectValue(_props: { placeholder?: string; className?: string }) { return null }
SelectValue.displayName = "SelectValue"

function SelectContent({ children }: any) { return <>{children}</> }

function SelectItem(_props: { value: string; children: React.ReactNode }) { return null }
SelectItem.displayName = "SelectItem"

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
