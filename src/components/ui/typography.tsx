import * as React from "react";
import { cn } from "@/lib/utils";
import { useGlobalStyles } from "@/contexts/GlobalStyleContext";

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function PageHeading({ className, children, style, ...props }: TypographyProps) {
  const { pageHeading, styles } = useGlobalStyles();
  return (
    <h1
      className={cn(pageHeading, "leading-tight tracking-tight font-display max-sm:text-[clamp(1.5rem,5vw,3.75rem)]", className)}
      style={{ ...style, fontFamily: `"${styles.headingFontFamily}", sans-serif` }}
      {...props}
    >
      {children}
    </h1>
  );
}

export function SectionHeading({ className, children, style, ...props }: TypographyProps) {
  const { sectionHeading, styles } = useGlobalStyles();
  return (
    <h2
      className={cn(sectionHeading, "leading-tight tracking-tight font-display", className)}
      style={{ ...style, fontFamily: `"${styles.headingFontFamily}", sans-serif` }}
      {...props}
    >
      {children}
    </h2>
  );
}

export function CardTitleStyled({ className, children, style, ...props }: TypographyProps) {
  const { cardTitle, styles } = useGlobalStyles();
  return (
    <h3
      className={cn(cardTitle, "leading-none tracking-tight", className)}
      style={{ ...style, fontFamily: `"${styles.headingFontFamily}", sans-serif` }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function DialogTitleStyled({ className, children, style, ...props }: TypographyProps) {
  const { dialogTitle, styles } = useGlobalStyles();
  return (
    <span
      className={cn(dialogTitle, "leading-none tracking-tight", className)}
      style={{ ...style, fontFamily: `"${styles.headingFontFamily}", sans-serif` }}
      {...props}
    >
      {children}
    </span>
  );
}

export function BodyText({ className, children, style, ...props }: TypographyProps) {
  const { bodyText, styles } = useGlobalStyles();
  return (
    <p
      className={cn(bodyText, className)}
      style={{ ...style, fontFamily: `"${styles.bodyFontFamily}", sans-serif` }}
      {...props}
    >
      {children}
    </p>
  );
}

export function SmallText({ className, children, style, ...props }: TypographyProps) {
  const { smallText, styles } = useGlobalStyles();
  return (
    <p
      className={cn(smallText, className)}
      style={{ ...style, fontFamily: `"${styles.bodyFontFamily}", sans-serif` }}
      {...props}
    >
      {children}
    </p>
  );
}

export function LabelText({ className, children, style, ...props }: TypographyProps) {
  const { labelText, styles } = useGlobalStyles();
  return (
    <span
      className={cn(labelText, className)}
      style={{ ...style, fontFamily: `"${styles.bodyFontFamily}", sans-serif` }}
      {...props}
    >
      {children}
    </span>
  );
}
