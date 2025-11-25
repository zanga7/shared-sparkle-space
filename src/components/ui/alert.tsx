import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Copy, Check } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & {
    allowCopy?: boolean
  }
>(({ className, variant, allowCopy = false, children, ...props }, ref) => {
  const [copied, setCopied] = React.useState(false)
  const isDestructive = variant === "destructive"
  
  const handleCopy = async () => {
    const textContent = ref && 'current' in ref && ref.current 
      ? ref.current.textContent || ""
      : ""
    await navigator.clipboard.writeText(textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), "relative", className)}
      {...props}
    >
      {children}
      {allowCopy && isDestructive && (
        <button
          onClick={handleCopy}
          className="absolute top-4 right-4 rounded-md p-1 hover:bg-destructive-foreground/10 transition-colors"
          title="Copy error message"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
