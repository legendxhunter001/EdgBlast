import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function Checkbox({ checked, onCheckedChange }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(c) => onCheckedChange(c === true)}
      className="w-4 h-4 rounded border border-border bg-card flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:border-primary"
    >
      <RadixCheckbox.Indicator>
        <Check className="w-3 h-3" style={{ color: 'hsl(var(--primary-foreground))' }} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}
