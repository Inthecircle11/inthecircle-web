import { ForgotPasswordForm } from './ForgotPasswordForm'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams
  const raw = params?.email
  const emailParam = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  let initialEmail = ''
  if (emailParam) {
    try {
      const decoded = decodeURIComponent(emailParam).trim()
      if (isValidEmail(decoded)) initialEmail = decoded
    } catch {
      if (isValidEmail(emailParam.trim())) initialEmail = emailParam.trim()
    }
  }

  const errorParam = params?.error
  const linkExpired = errorParam === 'link_expired' || errorParam === 'access_denied'

  return <ForgotPasswordForm initialEmail={initialEmail} linkExpired={linkExpired} />
}
