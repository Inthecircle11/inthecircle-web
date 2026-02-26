import { SITE_URL, APP_STORE_URL } from "@/lib/constants";

/** JSON-LD for Organization + WebApplication so Google can show rich results for app searches. */
export function StructuredData() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "inthecircle",
    url: "https://inthecircle.co",
    logo: `${SITE_URL}/logo.png`,
    description: "The #1 networking app for creators. Connect with founders, creators, and digital professionals.",
    sameAs: [
      "https://inthecircle.co",
      "https://app.inthecircle.co",
      APP_STORE_URL,
    ].filter(Boolean),
  };

  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "inthecircle",
    url: SITE_URL,
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "iOS",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: "Join inthecircle – the #1 networking app for creators. Connect with founders, YouTubers, streamers & digital professionals. Download free on iOS.",
    screenshot: `${SITE_URL}/logo.png`,
    softwareVersion: "1.0",
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "inthecircle",
    url: SITE_URL,
    description: "inthecircle – #1 networking app for creators. Sign up and connect with creators.",
    publisher: { "@type": "Organization", name: "inthecircle" },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
