interface BadgeProps {
  variant: "success" | "warning" | "error" | "info";
  children: React.ReactNode;
}

const variantClasses: Record<BadgeProps["variant"], string> = {
  success: "bg-success-50 text-success-700",
  warning: "bg-yellow-50 text-yellow-700",
  error: "bg-error-50 text-error-700",
  info: "bg-primary-50 text-primary-700",
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
