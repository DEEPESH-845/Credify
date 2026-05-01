import Link from "next/link";
import PageLayout from "@/components/PageLayout";

export default function NotFound() {
  return (
    <PageLayout maxWidth="max-w-md">
      <div className="rounded-lg bg-white p-8 shadow-card text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Page Not Found</h1>
        <p className="mt-3 text-neutral-600">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/feed"
            className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          >
            Go to Feed
          </Link>
          <Link
            href="/login"
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 rounded"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}