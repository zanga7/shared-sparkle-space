import { useTheme } from "next-themes"
import { Toaster as Sonner, toast as sonnerToast, ExternalToast } from "sonner"
import { Copy, Check } from "lucide-react"
import * as React from "react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg pointer-events-auto",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

// Copy button component for error toasts
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = React.useState(false)
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-md p-1.5 text-current/70 hover:text-current transition-colors"
      title="Copy error message"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

// Enhanced toast wrapper that adds copy button for errors
const toast = Object.assign(
  (message: string | React.ReactNode, options?: ExternalToast) => {
    return sonnerToast(message, options)
  },
  {
    success: (message: string | React.ReactNode, options?: ExternalToast) => {
      return sonnerToast.success(message, options)
    },
    info: (message: string | React.ReactNode, options?: ExternalToast) => {
      return sonnerToast.info(message, options)
    },
    warning: (message: string | React.ReactNode, options?: ExternalToast) => {
      return sonnerToast.warning(message, options)
    },
    error: (message: string | React.ReactNode, options?: ExternalToast) => {
      const errorText = typeof message === 'string' ? message : 
        (options?.description && typeof options.description === 'string') 
          ? `${message}: ${options.description}` 
          : String(message)
      
      return sonnerToast.error(message, {
        ...options,
        action: options?.action || {
          label: <CopyButton text={errorText} />,
          onClick: () => {} // CopyButton handles the click
        }
      })
    },
    loading: (message: string | React.ReactNode, options?: ExternalToast) => {
      return sonnerToast.loading(message, options)
    },
    promise: sonnerToast.promise,
    dismiss: sonnerToast.dismiss,
    message: sonnerToast.message,
    custom: sonnerToast.custom,
  }
)

export { Toaster, toast }
