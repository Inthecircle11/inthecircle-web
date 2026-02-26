/**
 * Admin access is now verified server-side via /api/admin/check
 * Set ADMIN_USER_IDS and ADMIN_EMAILS in .env.local (never use NEXT_PUBLIC_)
 */

/** Client-only: base path for admin (from layout’s data-value). Use for redirects so obscure path works. */
export function getAdminBase(): string {
  if (typeof document === 'undefined') return '/admin'
  return document.getElementById('admin-base')?.getAttribute('data-value') || '/admin'
}
