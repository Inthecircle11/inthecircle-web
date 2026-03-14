import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Download Inthecircle',
  description: 'Download the Inthecircle app for iOS or Android.',
  robots: { index: true, follow: true },
}

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
