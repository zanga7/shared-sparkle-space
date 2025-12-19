import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { Copy, Check } from "lucide-react"
import { useState } from "react"

export function Toaster() {
  const { toasts } = useToast()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isError = variant === "destructive"
        const errorText = `${title || ""}${title && description ? ": " : ""}${description || ""}`
        
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="grid gap-1 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {isError && (
              <button
                onClick={() => handleCopy(errorText, id)}
                className="shrink-0 rounded-md p-2 bg-destructive-foreground/10 hover:bg-destructive-foreground/20 text-destructive-foreground transition-colors"
                title="Copy error message"
                aria-label="Copy error message"
              >
                {copiedId === id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            )}
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
