/**
 * Shared types and the Worker `Env` binding surface.
 * Mirrors carest's binding shape: D1 (DB) + KV (SESSION) + secrets/vars.
 */

export interface Env {
  // Bindings
  DB: D1Database;
  SESSION: KVNamespace;

  // Vars (wrangler.toml [vars])
  CLAUDE_MODEL: string;
  CLAUDE_MODEL_STRONG: string;
  WEB_BASE_URL: string;

  // Secrets (wrangler secret put)
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  CLAUDE_API_KEY: string;
  LIFF_ID: string;
}

/** A community member (a LINE user who followed the influencer's OA). */
export interface Member {
  id: number;
  influencer_id: number;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  level_id: number | null;
  status: 'active' | 'blocked' | 'left';
  engagement_score: number;
  joined_at: string;
  last_seen_at: string | null;
}

/** A manually-assigned membership tier defined by the influencer. */
export interface Level {
  id: number;
  influencer_id: number;
  name: string;
  rank: number; // 0 = lowest/default
  color: string | null;
  perks: string | null;
  is_default: number; // 0/1
}

/** The community owner. Multi-tenant-ready; runs single-tenant for now. */
export interface Influencer {
  id: number;
  name: string;
  line_channel_id: string | null;
  created_at: string;
}

/** A piece of content / announcement, optionally gated by minimum level rank. */
export interface Content {
  id: number;
  influencer_id: number;
  title: string;
  body: string;
  min_level_rank: number; // 0 = visible to everyone
  published_at: string | null;
  created_at: string;
}

/** A broadcast send job targeting an audience segment. */
export interface Broadcast {
  id: number;
  influencer_id: number;
  message: string;
  audience: 'all' | 'level' | 'segment';
  audience_level_id: number | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_at: string | null;
  sent_count: number;
  created_at: string;
}

export type EngagementKind =
  | 'message_in'
  | 'postback'
  | 'content_open'
  | 'link_click'
  | 'follow'
  | 'broadcast_read';
