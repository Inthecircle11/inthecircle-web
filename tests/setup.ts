/**
 * Admin integration test setup.
 * Mocks auth so route handlers run as super_admin without real cookies.
 * Uses real Supabase service client from env for DB seeding and assertions.
 */

const TEST_ADMIN_USER_ID = '00000000-0000-4000-a000-000000000001'
const TEST_ADMIN_EMAIL = 'admin-integration-test@test.local'

// Silence expected console output when Supabase env is not set (500s and skip warning)
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  jest.restoreAllMocks()
})

jest.mock('@/lib/admin-auth', () => {
  const actual = jest.requireActual('@/lib/admin-auth') as typeof import('@/lib/admin-auth')
  return {
    ...actual,
    requireAdmin: jest.fn().mockImplementation(async () => {
      const { getServiceRoleClient } = jest.requireActual('@/lib/supabase-service') as typeof import('@/lib/supabase-service')
      return {
        authorized: true,
        user: { id: TEST_ADMIN_USER_ID, email: TEST_ADMIN_EMAIL },
        supabase: getServiceRoleClient(),
        roles: ['super_admin'],
      }
    }),
    requirePermission: jest.fn().mockReturnValue(null),
  }
})

process.env.ADMIN_USER_IDS = process.env.ADMIN_USER_IDS || TEST_ADMIN_USER_ID
process.env.TEST_ADMIN_USER_ID = TEST_ADMIN_USER_ID

export const TEST_ADMIN_ID = TEST_ADMIN_USER_ID
export const TEST_ADMIN_EMAIL_EXPORT = TEST_ADMIN_EMAIL
