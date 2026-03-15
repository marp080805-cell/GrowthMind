-- Tabela para rastrear posts Instagram já transformados em anúncios
-- Migration: 006_sponsored_posts.sql

CREATE TABLE IF NOT EXISTS sponsored_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  instagram_account_id text NOT NULL,
  post_id text NOT NULL,
  ad_id text,
  adset_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, post_id)
);

ALTER TABLE sponsored_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsored_posts_authenticated" ON sponsored_posts
  FOR ALL USING (auth.uid() IS NOT NULL);
