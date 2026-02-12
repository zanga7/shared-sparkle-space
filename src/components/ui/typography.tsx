import * as React from "react";
import { cn } from "@/lib/utils";
import { useGlobalStyles } from "@/contexts/GlobalStyleContext";

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function PageHeading({ className, children, ...props }: TypographyProps) {
  const { pageHeading } = useGlobalStyles();
  return (
    <h1 className={cn(pageHeading, "leading-tight tracking-tight font-display", className)} {...props}>
      {children}
    </h1>
  );
}

export function SectionHeading({ className, children, ...props }: TypographyProps) {
  const { sectionHeading } = useGlobalStyles();
  return (
    <h2 className={cn(sectionHeading, "leading-tight tracking-tight font-display", className)} {...props}>
      {children}
    </h2>
  );
}

export function CardTitleStyled({ className, children, ...props }: TypographyProps) {
  const { cardTitle } = useGlobalStyles();
  return (
    <h3 className={cn(cardTitle, "leading-none tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}

export function DialogTitleStyled({ className, children, ...props }: TypographyProps) {
  const { dialogTitle } = useGlobalStyles();
  return (
    <span className={cn(dialogTitle, "leading-none tracking-tight", className)} {...props}>
      {children}
    </span>
  );
}

export function BodyText({ className, children, ...props }: TypographyProps) {
  const { bodyText } = useGlobalStyles();
  return (
    <p className={cn(bodyText, className)} {...props}>
      {children}
    </p>
  );
}

export function SmallText({ className, children, ...props }: TypographyProps) {
  const { smallText } = useGlobalStyles();
  return (
    <p className={cn(smallText, className)} {...props}>
      {children}
    </p>
  );
}

export function LabelText({ className, children, ...props }: TypographyProps) {
  const { labelText } = useGlobalStyles();
  return (
    <span className={cn(labelText, className)} {...props}>
      {children}
    </span>
  );
}
