import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-bold transition-[transform,box-shadow,background-color,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-bun-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bun-paper active:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-bun-red via-bun-orange to-bun-gold text-bun-ink shadow-lg shadow-bun-orange/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-bun-orange/30",
  secondary:
    "border border-current/20 bg-bun-paper/85 text-bun-text shadow-sm backdrop-blur-md hover:-translate-y-0.5 hover:border-bun-orange/60 hover:text-bun-accent hover:shadow-md",
  ghost: "text-bun-muted hover:bg-bun-text/8 hover:text-bun-text",
  icon: "text-bun-text hover:bg-bun-text/10 hover:text-bun-accent",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-sm",
  lg: "h-14 px-7 text-base",
  icon: "size-11 shrink-0 p-0",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonVariants({ variant, size, className })} {...props} />;
});