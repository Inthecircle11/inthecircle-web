import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Child safety standards | inthecircle",
  description:
    "Inthecircle's standards and practices against child sexual abuse and exploitation (CSAE). Reporting, prevention, and compliance.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/safety-standards` },
};

export default function SafetyStandardsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[42rem] px-6 py-12 sm:py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
          Child safety standards
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Inthecircle: Creator Network — our standards against child sexual abuse and exploitation (CSAE)
        </p>

        <div className="mt-8 space-y-6 text-[var(--text-secondary)]">
          <p>
            Inthecircle has zero tolerance for child sexual abuse and exploitation (CSAE). We are committed to preventing, detecting, and responding to such content and conduct on our platform.
          </p>

          <h2 className="text-lg font-semibold text-[var(--text)] mt-8">Reporting</h2>
          <p>
            Users can report concerns in the app, including content or behavior that may involve child safety. In profile and chat screens, use <strong className="text-[var(--text)]">Report</strong> and select a reason (e.g. Inappropriate content, Harassment, Other). Reports are reviewed by our team. We take all reports seriously and act in line with our policies and applicable law.
          </p>

          <h2 className="text-lg font-semibold text-[var(--text)] mt-8">Prevention and enforcement</h2>
          <p>
            We use a combination of product design (e.g. in-app reporting, blocking), review processes, and enforcement to reduce risk of CSAE. Accounts and content that violate our standards are removed. We may report to relevant regional and national authorities where required by law.
          </p>

          <h2 className="text-lg font-semibold text-[var(--text)] mt-8">Contact</h2>
          <p>
            For child safety concerns or questions about these standards, contact us at{" "}
            <a href="mailto:support@inthecircle.co" className="text-[var(--accent-purple)] hover:underline">
              support@inthecircle.co
            </a>
            . For the contact associated with this developer account, see the email shown in Google Play Console.
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
