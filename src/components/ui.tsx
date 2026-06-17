import { forwardRef } from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// Eyebrow label — 10px tracked lowercase. §5.3
export function Eyebrow({
  children,
  className,
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <p
      className={cx(
        "text-[10px] lowercase",
        accent ? "text-accent" : "text-tertiary",
        className
      )}
      style={{ letterSpacing: "0.22em" }}
    >
      {children}
    </p>
  );
}

// Primary CTA — amber, black text, full width on mobile. §5.5
export const PrimaryButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function PrimaryButton({ className, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cx(
        "w-full rounded-md px-5 py-3 font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/40",
        disabled
          ? "bg-[#27272a] text-tertiary"
          : "bg-accent text-black active:bg-amber-600 active:scale-[0.98]",
        className
      )}
      {...props}
    />
  );
});

// Secondary — bordered, transparent. §5.5
export const SecondaryButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SecondaryButton({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        "w-full rounded-md border border-[#3f3f46] px-5 py-3 text-primary transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-amber-500/40 active:border-[#52525b]",
        className
      )}
      {...props}
    />
  );
});

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        "w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary",
        "placeholder:text-[#52525b] focus:border-accent focus:outline-none focus:ring-1 focus:ring-amber-500/20",
        className
      )}
      {...props}
    />
  );
});

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[13px] text-tertiary">
      {children}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-[13px] text-rejected">{children}</p>;
}

// Page shell with the §5.4 horizontal padding (20px mobile / 28px desktop).
export function Page({ children, className }: DivProps) {
  return (
    <div className={cx("mx-auto w-full max-w-[1100px] px-5 sm:px-7", className)}>
      {children}
    </div>
  );
}

// Centered single-column shell used by auth/welcome. §13.1
export function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-stretch justify-center px-5 sm:px-7">
      <div className="mx-auto w-full max-w-[420px]">{children}</div>
    </div>
  );
}
