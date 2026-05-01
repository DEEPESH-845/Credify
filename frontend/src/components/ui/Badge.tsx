interface BadgeProps {
  variant: "success" | "warning" | "error" | "info";
  children: React.ReactNode;
}

const variantClasses: Record<BadgeProps["variant"], string> = {
  success: "bg-success-500/10 text-success-400 border border-success-500/20",
  warning: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  error: "bg-error-500/10 text-error-400 border border-error-500/20",
  info: "bg-primary-500/10 text-primary-400 border border-primary-500/20",
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
