import Link from 'next/link'
import { ExternalLink, FileText } from 'lucide-react'

interface Site {
  id: string
  name: string
  domain: string
  github_repo: string
  publish_format: string
}

interface SiteCardProps {
  site: Site
  pendingDraftCount: number
}

export default function SiteCard({ site, pendingDraftCount }: SiteCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-200 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{site.name}</h3>
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 mt-0.5"
          >
            {site.domain}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
          {site.publish_format.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4">
        <Link
          href={`/drafts?site_id=${site.id}&status=pending_review`}
          className="flex items-center gap-2 text-sm"
        >
          <FileText className="w-4 h-4 text-gray-400" />
          {pendingDraftCount > 0 ? (
            <span className="font-medium text-[#2563EB]">
              {pendingDraftCount} draft{pendingDraftCount !== 1 ? 's' : ''} pending review
            </span>
          ) : (
            <span className="text-gray-400">No pending drafts</span>
          )}
        </Link>

        <a
          href={`https://github.com/${site.github_repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          {site.github_repo}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
