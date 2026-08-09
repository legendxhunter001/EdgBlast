import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium tracking-tight ring-offset-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(187_22%_47%)] text-white border border-[hsl(187_24%_40%)]/40 shadow-xs hover:bg-[hsl(187_24%_42%)]",
        destructive:
          "bg-[hsl(0_30%_65%)] text-white border border-[hsl(0_30%_55%)]/40 shadow-xs hover:bg-[hsl(0_30%_60%)]",
        success:
          "bg-[hsl(217_36%_63%)] text-white border border-[hsl(217_36%_54%)]/40 shadow-xs hover:bg-[hsl(217_36%_58%)]",
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:bg-secondary hover:border-border/80 dark:bg-[hsl(213_12%_17%)]",
        secondary:
          "border border-border bg-card text-foreground shadow-xs hover:bg-secondary dark:bg-[hsl(213_12%_17%)]",
        ghost:
          "text-foreground hover:bg-secondary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-[8px] px-3.5",
        lg: "h-12 rounded-[10px] px-7",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
