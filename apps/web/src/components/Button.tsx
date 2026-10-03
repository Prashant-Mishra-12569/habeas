import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "quiet";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-5 text-base font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-pen text-pen-ink hover:bg-[color-mix(in_oklab,var(--pen)_88%,var(--ink))]",
  secondary: "border-2 border-pen text-pen hover:bg-[color-mix(in_oklab,var(--pen)_8%,transparent)]",
  quiet: "px-1 text-pen underline decoration-2 underline-offset-4 hover:decoration-[3px]",
};

export function Button({
  variant = "primary",
  busy,
  children,
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...props}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={`${base} ${variants[variant]} ${className}`} />;
}
