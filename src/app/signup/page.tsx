'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { APP_STORE_URL } from '@/lib/constants'
import { Logo } from '@/components/Logo'

// Niche options matching iOS app
const NICHES = [
  { value: 'Travel', icon: '✈️' },
  { value: 'Lifestyle', icon: '❤️' },
  { value: 'Business', icon: '💼' },
  { value: 'Fashion', icon: '👕' },
  { value: 'Fitness', icon: '🏃' },
  { value: 'Food', icon: '🍴' },
  { value: 'Tech', icon: '💻' },
  { value: 'Beauty', icon: '✨' },
  { value: 'Music', icon: '🎵' },
  { value: 'Art', icon: '🎨' },
  { value: 'Gaming', icon: '🎮' },
  { value: 'Education', icon: '📚' },
  { value: 'Entertainment', icon: '🎬' },
  { value: 'Other', icon: '⋯' },
]

// Country codes for phone
const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'SA', flag: '🇸🇦' },
  { code: '+20', country: 'EG', flag: '🇪🇬' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+86', country: 'CN', flag: '🇨🇳' },
  { code: '+55', country: 'BR', flag: '🇧🇷' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
]

// Format number with commas (e.g., 1000 → 1,000)
function formatWithCommas(value: string): string {
  const digits = value.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return parseInt(digits).toLocaleString('en-US')
}

// Format follower count for display (e.g., 5K, 1.5M)
function formatFollowerCount(value: string): string {
  const num = parseInt(value.replace(/,/g, ''))
  if (isNaN(num)) return value
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return value
}

// Password strength evaluation (matches iOS app)
function evaluatePasswordStrength(password: string): { level: number; label: string; color: string } {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { level: 1, label: 'Weak', color: '#EF4444' }
  if (score <= 4) return { level: 2, label: 'Fair', color: '#F59E0B' }
  if (score <= 6) return { level: 3, label: 'Good', color: '#22C55E' }
  return { level: 4, label: 'Strong', color: '#A855F7' }
}

// Password requirements check
function getPasswordRequirements(password: string) {
  return [
    { met: password.length >= 6, text: 'At least 6 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
    { met: /[^A-Za-z0-9]/.test(password), text: 'One special character (optional)' },
  ]
}

// Email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

type Step = 'basic' | 'profile' | 'social' | 'complete'

export default function SignUp() {
  const _router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('basic')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  
  // Basic Info
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  
  // Profile Info
  const [niche, setNiche] = useState('')
  const [phoneCode, setPhoneCode] = useState('+971')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [instagramUsername, setInstagramUsername] = useState('')
  const [followerCount, setFollowerCount] = useState('')
  
  // Social Accounts (optional)
  const [tiktokUsername, setTiktokUsername] = useState('')
  const [youtubeUsername, setYoutubeUsername] = useState('')
  const [twitterUsername, setTwitterUsername] = useState('')
  const [linkedinUsername, setLinkedinUsername] = useState('')
  
  // Application Questions
  const [whyJoin, setWhyJoin] = useState('')

  // Progress calculation (matches iOS: 7 required fields)
  const progress = (() => {
    let filled = 0
    const total = 7
    if (name.trim()) filled++
    if (email.trim()) filled++
    if (password.length >= 6) filled++
    if (username.trim()) filled++
    if (niche) filled++
    if (instagramUsername.trim()) filled++
    const followerNum = parseInt(followerCount.replace(/,/g, ''))
    if (!isNaN(followerNum) && followerNum > 0) filled++
    return Math.round((filled / total) * 100)
  })()

  // Generate username from name
  function generateUsername(nameVal: string): string {
    return nameVal.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 15) + Math.floor(Math.random() * 100)
  }

  // Validate step
  function validateStep(): boolean {
    setError(null)
    
    if (step === 'basic') {
      if (!name.trim()) { setError('Please enter your name'); return false }
      if (!email.trim()) { setError('Please enter your email'); return false }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return false }
      if (!username.trim()) { setError('Please choose a username'); return false }
      return true
    }
    
    if (step === 'profile') {
      if (!niche) { setError('Please select your niche'); return false }
      if (!phoneNumber.trim()) { setError('Please enter your phone number'); return false }
      if (!instagramUsername.trim()) { setError('Please enter your Instagram username'); return false }
      const followerNum = parseInt(followerCount.replace(/,/g, ''))
      if (!followerCount || isNaN(followerNum) || followerNum <= 0) { 
        setError('Please enter your follower count'); return false 
      }
      return true
    }
    
    return true
  }

  // Handle next step
  function handleNext() {
    if (!validateStep()) return
    
    if (step === 'basic') setStep('profile')
    else if (step === 'profile') setStep('social')
    else if (step === 'social') handleSubmit()
  }

  // Handle back
  function handleBack() {
    if (step === 'profile') setStep('basic')
    else if (step === 'social') setStep('profile')
  }

  // Handle submit
  async function handleSubmit() {
    if (loading) return
    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const trimmedEmail = email.trim().toLowerCase()
      const trimmedName = name.trim()
      const trimmedUsername = username.trim().toLowerCase().replace('@', '')
      const trimmedInstagram = instagramUsername.trim().replace('@', '')

      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
        },
      })

      if (signUpError) throw signUpError

      if (data.user && !data.session) {
        setStep('complete')
        setLoading(false)
        return
      }
      
      if (!data.user) throw new Error('Failed to create account')

      // Build connected accounts array (same as iOS)
      const connectedAccounts = []
      if (trimmedInstagram) {
        connectedAccounts.push({
          platform: 'Instagram',
          username: trimmedInstagram,
          is_verified: false
        })
      }
      if (tiktokUsername.trim()) {
        connectedAccounts.push({
          platform: 'TikTok',
          username: tiktokUsername.trim().replace('@', ''),
          is_verified: false
        })
      }
      if (youtubeUsername.trim()) {
        connectedAccounts.push({
          platform: 'YouTube',
          username: youtubeUsername.trim().replace('@', ''),
          is_verified: false
        })
      }
      if (twitterUsername.trim()) {
        connectedAccounts.push({
          platform: 'Twitter',
          username: twitterUsername.trim().replace('@', ''),
          is_verified: false
        })
      }
      if (linkedinUsername.trim()) {
        connectedAccounts.push({
          platform: 'LinkedIn',
          username: linkedinUsername.trim().replace('@', ''),
          is_verified: false
        })
      }

      // Create profile in profiles table
      const userId = data.user.id
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: trimmedName,
          email: trimmedEmail,
          username: trimmedUsername || generateUsername(trimmedName),
          niche: niche,
          about: followerCount ? `Follower count: ${followerCount}` : null,
          connected_accounts: connectedAccounts.length > 0 ? connectedAccounts : null,
          created_at: new Date().toISOString(),
          is_verified: false,
        })

      if (profileError) console.error('Profile creation error:', profileError)

      // Create application
      const { error: appError } = await supabase
        .from('applications')
        .insert({
          user_id: userId,
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
        })

      if (appError) console.error('Application creation error:', appError)

      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate username when name changes
  function handleNameChange(value: string) {
    setName(value)
    if (!username || username === generateUsername(name)) {
      setUsername(generateUsername(value))
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient matching iOS */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0a0a] to-[#141414]" />
      
      {/* Decorative glows */}
      <div className="glow-white w-[350px] h-[350px] -top-20 -left-32" />
      <div className="glow-purple w-[300px] h-[300px] bottom-[180px] -right-20" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="p-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <Logo size="sm" />
            inthecircle
          </Link>
        </header>

        <div className="max-w-lg mx-auto px-6 py-8">
          {/* Progress Bar - iOS style */}
          {step !== 'complete' && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-[var(--text-secondary)] mb-3">
                <span className="font-medium">{progress}% complete</span>
                <span>Step {step === 'basic' ? 1 : step === 'profile' ? 2 : 3} of 3</span>
              </div>
              <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--accent)] transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-[var(--radius-sm)] text-[var(--error)] text-sm flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" />
              </svg>
              {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 'basic' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-[28px] font-bold text-[var(--text)] mb-2">Join the creator community</h1>
                <p className="text-[var(--text-secondary)]">Create your account to get started</p>
              </div>

              {/* Sign up only (sign-in disabled for now) */}
              <div className="mb-6">
                <span className="inline-block py-2.5 px-4 text-sm font-medium rounded-[var(--radius-sm)] bg-[var(--surface)] text-[var(--text)] border border-[var(--separator)]">
                  Sign Up
                </span>
              </div>

              {/* Form Card */}
              <div className="card-premium p-6 rounded-[var(--radius-lg)]">
                <div className="space-y-5">
                  {/* Name Field */}
                  <div>
                    <label htmlFor="signup-name" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                      Full Name
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      className={`input-field ${name.trim() ? 'border-[var(--success)]/50' : ''}`}
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                    {name.trim() && (
                      <p className="text-xs text-[var(--success)] mt-1.5 flex items-center gap-1">
                        <span>✓</span> Looks good
                      </p>
                    )}
                  </div>

                  {/* Username Field */}
                  <div>
                    <label htmlFor="signup-username" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                      Username
                    </label>
                    <div className={`relative flex items-stretch rounded-[var(--radius-sm)] border bg-[var(--input-bg)] transition-[border-color,box-shadow] focus-within:border-[var(--accent-purple)] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] ${username.trim() ? 'border-[var(--success)]/50' : 'border-[var(--separator)]'}`}>
                      <span className="flex items-center pl-4 text-[var(--text-muted)] text-base pointer-events-none select-none" aria-hidden="true">@</span>
                      <input
                        id="signup-username"
                        type="text"
                        className="flex-1 min-w-0 py-3.5 pr-4 pl-1 text-base bg-transparent border-0 outline-none text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-0"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">This will be your unique handle</p>
                  </div>

                  {/* Email Field */}
                  <div>
                    <label htmlFor="signup-email" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                      Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      className={`input-field ${
                        email && isValidEmail(email) ? 'border-[var(--success)]/50' : 
                        email && !isValidEmail(email) ? 'border-[var(--error)]/50' : ''
                      }`}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {email && !isValidEmail(email) && (
                      <p className="text-xs text-[var(--error)] mt-1.5">Please enter a valid email address</p>
                    )}
                    {email && isValidEmail(email) && (
                      <p className="text-xs text-[var(--success)] mt-1.5 flex items-center gap-1">
                        <span>✓</span> Valid email
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="signup-password" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="signup-password"
                        type={isPasswordVisible ? 'text' : 'password'}
                        className={`input-field pr-12 ${password.length >= 6 ? 'border-[var(--success)]/50' : ''}`}
                        placeholder="Create a secure password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                        aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                      >
                        {isPasswordVisible ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* Password Strength Indicator */}
                    {password && (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3].map((index) => (
                            <div
                              key={index}
                              className="flex-1 h-1 rounded-full transition-colors"
                              style={{
                                backgroundColor: index < evaluatePasswordStrength(password).level 
                                  ? evaluatePasswordStrength(password).color 
                                  : 'var(--surface)'
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: evaluatePasswordStrength(password).color }}>
                          Password strength: {evaluatePasswordStrength(password).label}
                        </p>
                        
                        <div className="space-y-1.5 pt-1">
                          {getPasswordRequirements(password).map((req, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className={`text-xs ${req.met ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                                {req.met ? '✓' : '○'}
                              </span>
                              <span className={`text-xs ${req.met ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                                {req.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleNext}
                disabled={!name.trim() || !username.trim() || !isValidEmail(email) || password.length < 6}
                className="btn-primary w-full h-14 mt-6"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Profile Info */}
          {step === 'profile' && (() => {
            const followerNum = parseInt(followerCount.replace(/,/g, ''))
            const isStep2Valid = niche && phoneNumber.trim() && instagramUsername.trim() && !isNaN(followerNum) && followerNum > 0
            
            return (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center mb-8">
                  <h1 className="text-[28px] font-bold text-[var(--text)] mb-2">Tell us about yourself</h1>
                  <p className="text-[var(--text-secondary)]">Help us match you with the right creators</p>
                </div>

                {/* Niche Selection */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                    Your Niche
                    {niche && <span className="text-[var(--success)] ml-2">✓</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {NICHES.map((n) => (
                      <button
                        key={n.value}
                        onClick={() => setNiche(n.value)}
                        className={`p-3 rounded-[var(--radius-sm)] border text-left flex items-center gap-2 transition-all ${
                          niche === n.value 
                            ? 'border-[var(--accent-purple)] bg-[var(--accent-purple)]/20 text-[var(--text)]' 
                            : 'border-[var(--separator)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <span>{n.icon}</span>
                        <span className="text-sm">{n.value}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="signup-phone" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                    Phone Number
                    {phoneNumber.trim() && <span className="text-[var(--success)] ml-2">✓</span>}
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="signup-phone-code"
                      aria-label="Country code"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="input-field w-auto"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input
                      id="signup-phone"
                      type="tel"
                      className={`input-field flex-1 ${phoneNumber.trim() ? 'border-[var(--success)]/50' : ''}`}
                      placeholder="Phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                {/* Instagram Username */}
                <div>
                  <label htmlFor="signup-instagram" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                    Instagram Username
                    {instagramUsername.trim() && <span className="text-[var(--success)] ml-2">✓</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">@</span>
                    <input
                      id="signup-instagram"
                      type="text"
                      className={`input-field pl-8 ${instagramUsername.trim() ? 'border-[var(--success)]/50' : ''}`}
                      placeholder="instagram_handle"
                      value={instagramUsername}
                      onChange={(e) => setInstagramUsername(e.target.value)}
                    />
                  </div>
                </div>

                {/* Follower Count */}
                <div>
                  <label htmlFor="signup-followers" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                    Instagram Follower Count
                    {!isNaN(followerNum) && followerNum > 0 && <span className="text-[var(--success)] ml-2">✓</span>}
                  </label>
                  <input
                    id="signup-followers"
                    type="text"
                    inputMode="numeric"
                    className={`input-field ${!isNaN(followerNum) && followerNum > 0 ? 'border-[var(--success)]/50' : ''}`}
                    placeholder="e.g. 5,000"
                    value={followerCount}
                    onChange={(e) => setFollowerCount(formatWithCommas(e.target.value))}
                  />
                  {followerCount && !isNaN(followerNum) && followerNum > 0 && (
                    <p className="text-xs text-[var(--accent-purple)] mt-1.5">
                      That&apos;s {formatFollowerCount(followerCount)} followers
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleBack}
                    className="btn-secondary flex-1 h-14"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!isStep2Valid}
                    className="btn-primary flex-1 h-14"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Step 3: Social Accounts */}
          {step === 'social' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-[28px] font-bold text-[var(--text)] mb-2">Connect your socials</h1>
                <p className="text-[var(--text-secondary)]">Add more accounts to increase visibility (optional)</p>
              </div>

              <div className="card-premium p-6 rounded-[var(--radius-lg)] space-y-5">
                <div>
                  <label htmlFor="signup-tiktok" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">TikTok</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">@</span>
                    <input
                      id="signup-tiktok"
                      type="text"
                      className="input-field pl-8"
                      placeholder="tiktok_handle"
                      value={tiktokUsername}
                      onChange={(e) => setTiktokUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-youtube" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">YouTube</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">@</span>
                    <input
                      id="signup-youtube"
                      type="text"
                      className="input-field pl-8"
                      placeholder="youtube_channel"
                      value={youtubeUsername}
                      onChange={(e) => setYoutubeUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-twitter" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">X (Twitter)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">@</span>
                    <input
                      id="signup-twitter"
                      type="text"
                      className="input-field pl-8"
                      placeholder="twitter_handle"
                      value={twitterUsername}
                      onChange={(e) => setTwitterUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-linkedin" className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">LinkedIn</label>
                  <input
                    id="signup-linkedin"
                    type="text"
                    className="input-field"
                    placeholder="linkedin.com/in/yourprofile"
                    value={linkedinUsername}
                    onChange={(e) => setLinkedinUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--separator)]">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Why do you want to join? (optional)</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Tell us what you're looking for..."
                  value={whyJoin}
                  onChange={(e) => setWhyJoin(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleBack}
                  className="btn-secondary flex-1 h-14"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-gradient flex-1 h-14"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </div>
                  ) : (
                    'Complete Sign Up'
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-[var(--text-muted)]">
                By signing up, you agree to our{' '}
                <a href="https://inthecircle.co/terms/" className="underline hover:text-[var(--text-secondary)]">Terms</a>
                {' '}and{' '}
                <a href="https://inthecircle.co/privacy-policy/" className="underline hover:text-[var(--text-secondary)]">Privacy Policy</a>
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--radius-lg)] bg-[var(--success)]/10 border border-[var(--success)]/30 flex items-center justify-center">
                <span className="text-5xl">🎉</span>
              </div>
              <h1 className="text-[28px] font-bold text-[var(--text)] mb-4">Application Submitted!</h1>
              <p className="text-[var(--text-secondary)] mb-8 max-w-sm mx-auto">
                Your application is being reviewed. We&apos;ll notify you once approved. 
                In the meantime, download our app to complete your profile.
              </p>
              
              <a
                href={APP_STORE_URL}
                className="btn-primary inline-flex items-center gap-2 px-6 py-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Download iOS App
              </a>
              
              <p className="text-sm text-[var(--text-muted)] mt-8">
                Need help? Contact support.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
