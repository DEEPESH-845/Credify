import Link from "next/link";
import PageLayout from "@/components/PageLayout";

export default function NotFound() {
  return (
    <PageLayout maxWidth="max-w-md">
      <div className="rounded-xl bg-neutral-900/80 border border-white/[0.06] p-8 shadow-card backdrop-blur-sm text-center">
        <h1 className="text-3xl font-bold text-neutral-50">Page Not Found</h1>
        <p className="mt-3 text-neutral-400">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/feed"
            className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-primary-600/20 transition-all duration-200 hover:bg-primary-500 hover:shadow-lg hover:shadow-primary-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Go to Feed
          </Link>
          <Link
            href="/login"
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 rounded"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
