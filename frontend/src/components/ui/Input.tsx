import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  id: string;
}

export default function Input({
  label,
  error,
  id,
  className = "",
  ...rest
}: InputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-neutral-300 mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        className={`block w-full rounded-lg border bg-neutral-900/50 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:outline-none focus:border-primary-500/50 ${
          error
            ? "border-error-500/50"
            : "border-white/[0.06] hover:border-white/[0.12]"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-error-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
