import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/auth/", "/settings", "/feed", "/inbox", "/profile", "/explore", "/connect", "/portfolio", "/analytics", "/challenges", "/ideas", "/resources", "/search", "/matches", "/sprint", "/notifications", "/success", "/update-password"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/auth/", "/settings", "/feed", "/inbox", "/profile", "/explore", "/connect", "/portfolio", "/analytics", "/challenges", "/ideas", "/resources", "/search", "/matches", "/sprint", "/notifications", "/success", "/update-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
