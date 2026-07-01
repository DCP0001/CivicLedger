-- SQL Script to set up SecureVote Database Tables in Supabase
-- Copy and paste this script directly into your Supabase project's SQL Editor (https://supabase.com -> Project -> SQL Editor)

-- 1. Create Elections Table
CREATE TABLE IF NOT EXISTS public.elections (
    id BIGINT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Candidates Table
CREATE TABLE IF NOT EXISTS public.candidates (
    id BIGINT NOT NULL,
    election_id BIGINT NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    party TEXT NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (election_id, id)
);

-- 3. Create Voters Table
CREATE TABLE IF NOT EXISTS public.voters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'voter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Vote References Table
CREATE TABLE IF NOT EXISTS public.vote_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id BIGINT NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (election_id, wallet_address)
);

-- Enable RLS (Row Level Security) and configure public read-only access (or configure policies)
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_references ENABLE ROW LEVEL SECURITY;

-- Create Open Public Access Policies
CREATE POLICY "Allow public read access for elections" ON public.elections FOR SELECT USING (true);
CREATE POLICY "Allow public insert access for elections" ON public.elections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access for elections" ON public.elections FOR UPDATE USING (true);

CREATE POLICY "Allow public read access for candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Allow public insert access for candidates" ON public.candidates FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access for voters" ON public.voters FOR SELECT USING (true);
CREATE POLICY "Allow public insert access for voters" ON public.voters FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access for vote_references" ON public.vote_references FOR SELECT USING (true);
CREATE POLICY "Allow public insert access for vote_references" ON public.vote_references FOR INSERT WITH CHECK (true);
