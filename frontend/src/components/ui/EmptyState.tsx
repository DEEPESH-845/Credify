import Link from "next/link";
import Card from "./Card";

interface EmptyStateProps {
  message: string;
  action?: { label: string; href: string };
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mb-4 h-12 w-12 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
        <p className="text-neutral-700">{message}</p>
        {action && (
          <Link
            href={action.href}
            className="mt-4 inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          >
            {action.label}
          </Link>
        )}
      </div>
    </Card>
  );
}
