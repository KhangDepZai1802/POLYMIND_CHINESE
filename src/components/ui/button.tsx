import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Xanh khi nghỉ, CAM khi hover — cam là màu tương tác phụ của thương hiệu.
        default:
          "bg-primary text-primary-foreground hover:bg-brand-orange hover:text-brand-orange-foreground",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-background shadow-xs hover:border-brand-orange/40 hover:bg-brand-orange/15 hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-brand-orange/15 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:text-brand-orange hover:underline",
      },
      // Chiều cao ở đây là chiều cao cho CHUỘT. Trước đây cả 8 size đều `h-11`
      // (44px) vì luật touch target bị áp thẳng vào class — hệ quả là `lg` bằng
      // đúng `xs`, không tạo được phân cấp bằng kích thước.
      //
      // Luật 44px cho ngón tay không mất đi, nó chuyển sang `globals.css`:
      //   @media (pointer: coarse) { button { min-height: 44px } }
      // `min-height` thắng `height`, nên trên cảm ứng mọi nút vẫn ≥44px.
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-8 gap-1 rounded-md px-3 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
