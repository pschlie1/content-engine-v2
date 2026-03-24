PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  github_repo TEXT NOT NULL,
  github_branch TEXT NOT NULL DEFAULT 'main',
  publish_format TEXT NOT NULL DEFAULT 'json',
  json_output_path TEXT,
  tsx_output_path TEXT,
  mdx_output_path TEXT NOT NULL DEFAULT 'content/posts',
  tone_guidelines TEXT NOT NULL DEFAULT '',
  product_context TEXT DEFAULT '',
  audience_description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS content_pillars (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_keywords TEXT NOT NULL DEFAULT '[]',
  rss_feeds TEXT NOT NULL DEFAULT '[]',
  subreddits TEXT NOT NULL DEFAULT '[]',
  newsapi_queries TEXT NOT NULL DEFAULT '[]',
  max_drafts_per_day INTEGER NOT NULL DEFAULT 2,
  score_threshold INTEGER NOT NULL DEFAULT 70,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pillars_site ON content_pillars(site_id);

CREATE TABLE IF NOT EXISTS discovered_stories (
  id TEXT PRIMARY KEY,
  pillar_id TEXT NOT NULL REFERENCES content_pillars(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'reddit', 'newsapi')),
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  source_metadata TEXT DEFAULT '{}',
  relevance_score INTEGER,
  score_justification TEXT,
  status TEXT NOT NULL DEFAULT 'discovered'
    CHECK (status IN ('discovered', 'scored', 'selected', 'skipped', 'processed')),
  discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_stories_pillar ON discovered_stories(pillar_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON discovered_stories(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_dedupe ON discovered_stories(pillar_id, source_url);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES discovered_stories(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  pillar_id TEXT NOT NULL REFERENCES content_pillars(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  meta_description TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  research_brief TEXT NOT NULL DEFAULT '{}',
  content_check_violations TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'published', 'publish_failed')),
  rejection_reason TEXT,
  github_commit_sha TEXT,
  published_url TEXT,
  published_at TEXT,
  review_started_at TEXT,
  review_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_drafts_site ON drafts(site_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_pillar ON drafts(pillar_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drafts_slug_site ON drafts(site_id, slug);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id),
  pillar_id TEXT REFERENCES content_pillars(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  stages_log TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  completed_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_site ON pipeline_runs(site_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON pipeline_runs(status);
