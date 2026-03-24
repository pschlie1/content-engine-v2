import Link from 'next/link'
import { ExternalLink, AlertTriangle } from 'lucide-react'

interface Draft {
  id: string
  title: string
  slug: string
  status: string
  site_name: string
  site_domain: string
  pillar_name: string
  relevance_score: number | null
  source_url: string
  source_type: string
  content_check_violations: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  publish_failed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
  publish_failed: 'Failed',
}

export default function DraftCard({ draft }: { draft: Draft }) {
  const violations: unknown[] = JSON.parse(draft.content_check_violations || '[]')
  const hasViolations = violations.length > 0
  const score = draft.relevance_score

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <Link href={`/drafts/${draft.id}`} className="block">
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[draft.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[draft.status] ?? draft.status}
              </span>
              <span className="text-xs text-gray-400">{draft.site_name}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{draft.pillar_name}</span>
              {hasViolations && (
                <span className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
                  <AlertTriangle className="w-3 h-3" />
                  {violations.length} violation{violations.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h3 className="font-medium text-gray-900 truncate">{draft.title}</h3>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {score !== null && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  score >= 80
                    ? 'bg-green-100 text-green-700'
                    : score >= 60
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {score}
              </span>
            )}
            <span className="text-xs text-gray-400">{timeAgo(draft.created_at)}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <a
            href={draft.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1"
          >
            <span className="capitalize">{draft.source_type}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Link>
  )
}
