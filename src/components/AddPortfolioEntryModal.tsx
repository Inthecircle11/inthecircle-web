'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

interface AddPortfolioEntryModalProps {
  userId: string
  onClose: () => void
  onAdded: () => void
}

const ENTRY_KINDS = [
  { id: 'brand_deal', label: 'Brand Deal', icon: '💼', description: 'Sponsored content or partnership' },
  { id: 'ugc', label: 'UGC', icon: '📱', description: 'User-generated content' },
  { id: 'collab', label: 'Collaboration', icon: '🤝', description: 'Work with other creators' },
  { id: 'personal', label: 'Personal', icon: '✨', description: 'Your own creative project' },
]

export default function AddPortfolioEntryModal({ userId, onClose, onAdded }: AddPortfolioEntryModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  
  // Form fields
  const [entryKind, setEntryKind] = useState('')
  const [title, setTitle] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brief, setBrief] = useState('')
  const [role, setRole] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [tags, setTags] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [mediaFiles, setMediaFiles] = useState<{ file: File; preview: string }[]>([])

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    const newFiles: { file: File; preview: string }[] = []
    for (let i = 0; i < files.length && mediaFiles.length + newFiles.length < 10; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
      if (file.size > 50 * 1024 * 1024) continue // 50MB limit

      const preview = URL.createObjectURL(file)
      newFiles.push({ file, preview })
    }

    setMediaFiles(prev => [...prev, ...newFiles])
  }

  function removeMedia(index: number) {
    setMediaFiles(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  async function handleSubmit() {
    if (!entryKind || !title.trim() || !brief.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    setError(null)
    const supabase = createClient()

    try {
      // Create the portfolio entry
      const { data: entry, error: entryError } = await supabase
        .from('portfolio_entries')
        .insert({
          user_id: userId,
          entry_kind: entryKind,
          title: title.trim(),
          brand_name: brandName.trim() || null,
          brief: brief.trim(),
          role: role.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
          links: linkUrl ? [{ url: linkUrl.trim(), label: linkLabel.trim() || 'View' }] : null,
          visibility: 'public',
          sort_order: 0,
        })
        .select()
        .single()

      if (entryError) throw entryError

      // Upload media files
      if (mediaFiles.length > 0 && entry) {
        setUploadingMedia(true)
        for (let i = 0; i < mediaFiles.length; i++) {
          const { file } = mediaFiles[i]
          const fileExt = file.name.split('.').pop()
          const fileName = `${userId}/${entry.id}/${Date.now()}-${i}.${fileExt}`
          
          const { error: uploadError } = await supabase.storage
            .from('portfolio-media')
            .upload(fileName, file)

          if (!uploadError) {
            // Create media record
            await supabase
              .from('portfolio_media')
              .insert({
                entry_id: entry.id,
                media_type: file.type.startsWith('video/') ? 'video' : 'image',
                storage_path: fileName,
                sort_order: i,
              })
          }
        }
      }

      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry')
    }
    setSaving(false)
    setUploadingMedia(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-[var(--bg)] rounded-[var(--radius-lg)] border border-[var(--separator)] shadow-2xl my-8 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--separator)] bg-[var(--bg)]">
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
          <h2 className="text-[17px] font-semibold">Add Portfolio Entry</h2>
          <div className="w-12" />
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            /* Step 1: Select entry type */
            <div>
              <p className="text-[var(--text-secondary)] text-sm mb-4">What type of work is this?</p>
              <div className="space-y-3">
                {ENTRY_KINDS.map(kind => (
                  <button
                    key={kind.id}
                    onClick={() => {
                      setEntryKind(kind.id)
                      setStep(2)
                    }}
                    className={`w-full p-4 rounded-[var(--radius-md)] border text-left flex items-center gap-4 transition-all ${
                      entryKind === kind.id
                        ? 'border-[var(--accent-purple)] bg-[var(--accent-purple)]/10'
                        : 'border-[var(--separator)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span className="text-3xl">{kind.icon}</span>
                    <div>
                      <p className="font-semibold">{kind.label}</p>
                      <p className="text-[var(--text-muted)] text-sm">{kind.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: Entry details */
            <div className="space-y-5">
              {/* Selected type indicator */}
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-[var(--accent-purple)] text-sm"
              >
                <span>{ENTRY_KINDS.find(k => k.id === entryKind)?.icon}</span>
                <span>{ENTRY_KINDS.find(k => k.id === entryKind)?.label}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                  Title <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Summer Fashion Campaign"
                  maxLength={100}
                />
              </div>

              {/* Brand Name (for brand deals) */}
              {(entryKind === 'brand_deal' || entryKind === 'ugc') && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                    Brand / Client
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Nike, Sephora"
                    maxLength={100}
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                  Description <span className="text-[var(--error)]">*</span>
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  className="input-field resize-none"
                  placeholder="Describe the project, your role, and the results..."
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-[var(--text-muted)] text-xs mt-1 text-right">{brief.length}/1000</p>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                  Your Role
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Creative Director, Content Creator"
                  maxLength={100}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="input-field"
                  placeholder="fashion, lifestyle, video (comma-separated)"
                />
              </div>

              {/* Link */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                  Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="input-field flex-1"
                    placeholder="https://..."
                  />
                  <input
                    type="text"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="input-field w-24"
                    placeholder="Label"
                  />
                </div>
              </div>

              {/* Media */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                  Media ({mediaFiles.length}/10)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {mediaFiles.map((media, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--surface)]">
                      {media.file.type.startsWith('video/') ? (
                        <video src={media.preview} className="w-full h-full object-cover" />
                      ) : (
                        <img src={media.preview} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => removeMedia(index)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {mediaFiles.length < 10 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-[var(--separator)] flex flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:border-[var(--accent-purple)] hover:text-[var(--accent-purple)] transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-xs">Add</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaSelect}
                  className="hidden"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={saving || !title.trim() || !brief.trim()}
                className="btn-primary w-full py-4 disabled:opacity-50"
              >
                {saving ? (uploadingMedia ? 'Uploading media...' : 'Saving...') : 'Add to Portfolio'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
