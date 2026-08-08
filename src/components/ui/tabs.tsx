import * as RadixTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'

export const Tabs = RadixTabs.Root
export function TabsList({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <RadixTabs.List className={`rounded-lg p-1 bg-secondary ${className}`}>
      {children}
    </RadixTabs.List>
  )
}
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className="flex-1 text-sm py-1.5 rounded-md text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground transition-colors"
    >
      {children}
    </RadixTabs.Trigger>
  )
}
export function TabsContent({ value, className = '', children }: { value: string; className?: string; children: ReactNode }) {
  return (
    <RadixTabs.Content value={value} className={className}>
      {children}
    </RadixTabs.Content>
  )
}
