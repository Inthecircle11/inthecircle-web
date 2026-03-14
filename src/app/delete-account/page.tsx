import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Delete your account | inthecircle",
  description:
    "How to request deletion of your Inthecircle (In The Circle) account and associated data. Steps for account and data deletion.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/delete-account` },
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[42rem] px-6 py-12 sm:py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
          Delete your account and data
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Inthecircle: Creator Network (In The Circle) — account and data deletion
        </p>

        <div className="mt-8 space-y-6 text-[var(--text-secondary)]">
          <p>
            To delete your account and associated data from our systems, use the app as follows:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open the <strong className="text-[var(--text)]">Inthecircle</strong> app on your device.</li>
            <li>Go to <strong className="text-[var(--text)]">Account</strong> (or <strong className="text-[var(--text)]">Settings</strong>).</li>
            <li>Tap <strong className="text-[var(--text)]">Delete Account</strong>.</li>
            <li>When prompted, type <strong className="text-[var(--text)]">DELETE</strong> to confirm.</li>
          </ol>
          <p>
            We delete your account and associated data from our systems when you confirm. This action cannot be undone.
          </p>
          <p>
            If you cannot access the app or need help, contact us at{" "}
            <a href="mailto:support@inthecircle.co" className="text-[var(--accent-purple)] hover:underline">
              support@inthecircle.co
            </a>
            .
          </p>
        </div>

        <div className="mt-10 border-t border-[var(--border)] pt-8">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--accent-purple)] hover:underline"
          >
            ← Back to inthecircle
          </Link>
        </div>
      </div>
    </div>
  );
}
