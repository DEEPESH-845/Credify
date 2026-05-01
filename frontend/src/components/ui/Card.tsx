interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-neutral-900/80 border border-white/[0.06] shadow-card backdrop-blur-sm transition-all duration-200${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
