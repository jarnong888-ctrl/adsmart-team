import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[10px] border bg-clip-padding text-[14px] font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-[#0F6B4F] bg-[#0F6B4F] text-white shadow-[0_1px_2px_rgba(20,32,27,0.12)] hover:border-[#0A5540] hover:bg-[#0A5540]",
        outline:
          "border-[#E4E8E5] bg-[#FFFFFF] text-[#3F4C46] shadow-none hover:bg-[#E9F4EE] hover:text-[#0F6B4F]",
        secondary:
          "border-[#DCE1DE] bg-[#E9F4EE] text-[#0F6B4F] shadow-none hover:bg-[#DDEFE5]",
        ghost:
          "border-transparent bg-transparent text-[#3F4C46] shadow-none hover:bg-[#E9F4EE] hover:text-[#0F6B4F]",
        destructive:
          "border-[#F5C2C0] bg-[#FEECEC] text-[#B42318] shadow-none hover:bg-[#F8D4D2]",
        link: "border-transparent text-[#0F6B4F] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[8px] px-3 text-[13px] in-data-[slot=button-group]:rounded-[8px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[8px] px-3 text-[13px] in-data-[slot=button-group]:rounded-[8px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
