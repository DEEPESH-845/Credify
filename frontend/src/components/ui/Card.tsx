interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={`rounded-lg bg-white shadow-card${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
