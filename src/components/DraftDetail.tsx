'use client'

import { useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { ExternalLink, AlertTriangle, CheckCircle, XCircle, Edit2, X, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Violation {
  type: 'em_dash' | 'semicolon' | 'banned_word'
  word?: string
  line: number
  text: string
}

interface Draft {
  id: string
  title: string
  slug: string
  meta_description: string
  body_markdown: string
  tags: string
  status: string
  site_id: string
  site_name: string
  site_domain: string
  publish_format: string
  pillar_name: string
  relevance_score: number | null
  source_url: string
  source_type: string
  content_check_violations: string
  rejection_reason: string | null
  published_url: string | null
  github_commit_sha: string | null
  created_at: string
  review_started_at: string | null
  review_completed_at: string | null
}

interface Props {
  draft: Draft
}

export default function DraftDetail({ draft }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [editedMarkdown, setEditedMarkdown] = useState(draft.body_markdown)
  const [editedTitle, setEditedTitle] = useState(draft.title)
  const [editedMeta, setEditedMeta] = useState(draft.meta_description)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const violations: Violation[] = JSON.parse(draft.content_check_violations || '[]')
  const tags: string[] = JSON.parse(draft.tags || '[]')

  // Set review_started_at on page load
  useEffect(() => {
    if (!draft.review_started_at && draft.status === 'pending_review') {
      fetch(`/api/v1/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_started_at: new Date().toISOString() }),
      }).catch(console.error)
    }
  }, [draft.id, draft.review_started_at, draft.status])

  const handleSave = useCallback(async () => {
    setLoading('saving')
    setError(null)
    try {
      const res = await fetch(`/api/v1/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle,
          meta_description: editedMeta,
          body_markdown: editedMarkdown,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setIsEditing(false)
      router.refresh()
    } catch {
      setError('Failed to save changes')
    } finally {
      setLoading(null)
    }
  }, [draft.id, editedMarkdown, editedMeta, editedTitle, router])

  const handleApprove = async () => {
    setLoading('approving')
    setError(null)
    try {
      const res = await fetch(`/api/v1/drafts/${draft.id}/approve`, { method: 'POST' })
      const data = (await res.json()) as { error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'Approve failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    setLoading('rejecting')
    setError(null)
    try {
      const res = await fetch(`/api/v1/drafts/${draft.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      })
      if (!res.ok) throw new Error('Reject failed')
      setShowRejectInput(false)
      router.refresh()
    } catch {
      setError('Failed to reject draft')
    } finally {
      setLoading(null)
    }
  }

  const isPending = draft.status === 'pending_review'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <a href="/drafts" className="text-sm text-gray-500 hover:text-gray-700">← Drafts</a>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 truncate max-w-xs">{draft.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {isPending && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading === 'saving'}
                className="flex items-center gap-2 text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {loading === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Markdown Preview */}
        <div className="lg:col-span-2">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Meta Description</label>
                <input
                  type="text"
                  value={editedMeta}
                  onChange={(e) => setEditedMeta(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Body Markdown</label>
                <textarea
                  value={editedMarkdown}
                  onChange={(e) => setEditedMarkdown(e.target.value)}
                  rows={30}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{draft.title}</h1>
              <p className="text-gray-500 text-sm mb-6">{draft.meta_description}</p>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{draft.body_markdown}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadata + Actions */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-400 text-xs">Site</dt>
                <dd className="text-gray-700">{draft.site_name}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Pillar</dt>
                <dd className="text-gray-700">{draft.pillar_name}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Status</dt>
                <dd className="text-gray-700 capitalize">{draft.status.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Relevance Score</dt>
                <dd className="text-gray-700">{draft.relevance_score ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Slug</dt>
                <dd className="text-gray-700 font-mono text-xs">{draft.slug}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs">Source</dt>
                <dd>
                  <a
                    href={draft.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2563EB] hover:underline flex items-center gap-1"
                  >
                    <span className="capitalize">{draft.source_type}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </dd>
              </div>
              {draft.published_url && (
                <div>
                  <dt className="text-gray-400 text-xs">Published URL</dt>
                  <dd>
                    <a href={draft.published_url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline text-xs break-all">
                      {draft.published_url}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            {tags.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <dt className="text-gray-400 text-xs mb-2">Tags</dt>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Check Violations */}
          {violations.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-800 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                {violations.length} Content Violation{violations.length !== 1 ? 's' : ''}
              </h3>
              <ul className="space-y-2">
                {violations.map((v, i) => (
                  <li key={i} className="text-xs text-yellow-700">
                    <span className="font-medium">Line {v.line}</span>
                    {v.type === 'banned_word' && v.word && (
                      <span className="ml-1 bg-yellow-200 px-1 rounded font-mono">{v.word}</span>
                    )}
                    {v.type === 'em_dash' && <span className="ml-1 bg-yellow-200 px-1 rounded">em dash</span>}
                    {v.type === 'semicolon' && <span className="ml-1 bg-yellow-200 px-1 rounded">semicolon</span>}
                    <p className="text-yellow-600 truncate">{v.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleApprove}
                  disabled={loading !== null}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  {loading === 'approving' ? 'Publishing…' : 'Approve & Publish'}
                </button>

                {!showRejectInput ? (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={loading !== null}
                    className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRejectInput(false)}
                        className="flex-1 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={loading !== null}
                        className="flex-1 text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {loading === 'rejecting' ? 'Rejecting…' : 'Confirm Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {draft.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-1">Rejection Reason</h3>
              <p className="text-sm text-red-700">{draft.rejection_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
