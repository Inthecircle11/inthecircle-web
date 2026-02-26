'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/components/AppShell'

const NICHES = [
  { value: 'Lifestyle & Entertainment', icon: '🎬' },
  { value: 'Food & Travel', icon: '✈️' },
  { value: 'Fitness & Wellness', icon: '💪' },
  { value: 'Tech & Gaming', icon: '🎮' },
  { value: 'Music & Art', icon: '🎵' },
  { value: 'Business & Finance', icon: '💼' },
  { value: 'Education', icon: '📚' },
  { value: 'Aviation', icon: '✈️' },
]

export default function EditProfilePage() {
  const router = useRouter()
  const { user, profile, refreshProfile } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // Form fields
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [about, setAbout] = useState('')
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Load profile data
  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setUsername(profile.username || '')
      setAbout(profile.about || '')
      setNiche(profile.niche || '')
      setLocation(profile.location || '')
      setProfileImageUrl(profile.profile_image_url || null)
    }
  }, [profile])

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !loading) {
      router.push('/signup')
    }
  }, [user, loading, router])

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    setUploadingImage(true)
    setError(null)
    const supabase = createClient()

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath)

      setProfileImageUrl(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
      setPreviewImage(null)
    }
    setUploadingImage(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || saving) return

    // Validation
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    if (!/^[a-z0-9_]+$/.test(username.toLowerCase())) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)
    const supabase = createClient()

    try {
      const updates = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        about: about.trim() || null,
        niche: niche || null,
        location: location.trim() || null,
        profile_image_url: profileImageUrl,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (updateError) {
        if (updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
          throw new Error('This username is already taken')
        }
        throw updateError
      }

      setSuccess(true)
      await refreshProfile()
      
      // Redirect after short delay
      setTimeout(() => {
        router.push('/profile')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    }
    setSaving(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const displayImage = previewImage || profileImageUrl

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--separator)]">
        <div className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link
            href="/profile"
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </Link>
          <h1 className="text-[17px] font-semibold">Edit Profile</h1>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-[var(--accent-purple)] hover:text-[var(--accent-purple-alt)] font-semibold text-[15px] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 rounded-[var(--radius-sm)] bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
            </svg>
            Profile updated successfully! Redirecting...
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-[var(--radius-sm)] bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Image */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-[var(--surface)] border-2 border-[var(--separator)]">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-4xl font-bold">
                    {(name || username || user.email || '?')[0]?.toUpperCase()}
                  </div>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[var(--accent-purple)] text-white shadow-lg hover:bg-[var(--accent-purple-alt)] transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <p className="text-[var(--text-muted)] text-[13px] mt-3">Tap to change photo</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Your full name"
              maxLength={50}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Username <span className="text-[var(--error)]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="input-field pl-8"
                placeholder="username"
                maxLength={30}
              />
            </div>
            <p className="text-[var(--text-muted)] text-[12px] mt-1.5">Only letters, numbers, and underscores</p>
          </div>

          {/* Bio/About */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Bio
            </label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="input-field resize-none"
              placeholder="Tell others about yourself..."
              rows={4}
              maxLength={300}
            />
            <p className="text-[var(--text-muted)] text-[12px] mt-1.5 text-right">{about.length}/300</p>
          </div>

          {/* Niche */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Niche
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NICHES.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNiche(niche === n.value ? '' : n.value)}
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

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Location
            </label>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field pl-10"
                placeholder="City, Country"
                maxLength={100}
              />
            </div>
          </div>

          {/* Submit button (mobile) */}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-4 md:hidden"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </main>
    </div>
  )
}
