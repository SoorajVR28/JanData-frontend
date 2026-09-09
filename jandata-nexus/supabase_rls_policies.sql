-- ==============================================================================
-- JanData Nexus 2 - Supabase Row Level Security (RLS) Policies
-- ==============================================================================
-- Run these statements in the Supabase SQL Editor to enable RLS and grant
-- SELECT read access to the frontend application (anon key).

-- 1. Enable Row Level Security on `observations` table
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- Create policy allowing public SELECT access to observations
CREATE POLICY "Allow public read access on observations"
ON observations
FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Enable Row Level Security on `document_chunks` table
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Create policy allowing public SELECT access to document_chunks
CREATE POLICY "Allow public read access on document_chunks"
ON document_chunks
FOR SELECT
TO anon, authenticated
USING (true);

-- ==============================================================================
-- Optional Vector Search / Keyword Indexing Enhancements
-- ==============================================================================

-- Create index on entity_name and indicator for fast observations querying
CREATE INDEX IF NOT EXISTS idx_observations_entity_indicator
ON observations(entity_name, indicator, year);

-- Create index on domain for domain filtering
CREATE INDEX IF NOT EXISTS idx_observations_domain
ON observations(domain);

-- Create Gin index on chunk_text for fast text searching in document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_text_search
ON document_chunks USING gin(to_tsvector('english', chunk_text));
