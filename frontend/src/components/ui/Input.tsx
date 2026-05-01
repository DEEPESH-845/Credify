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
        className="block text-sm font-medium text-neutral-700 mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        className={`block w-full rounded-md border px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 focus-visible:outline-none ${
          error
            ? "border-error-600"
            : "border-neutral-200 hover:border-neutral-400"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-error-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
