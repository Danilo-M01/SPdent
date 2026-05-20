-- =============================================================================
-- SP DENT — QA Schema v3.0 (Strict Constraints for UPSERT)
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO UPGRADE THE DB
-- =============================================================================

-- 1. CLEANUP DUPLICATE PHONES (Optional but recommended before adding constraint)
-- In a real prod scenario, you'd want to merge or delete duplicate phones manually.
-- This script assumes you either have no duplicates or handles them safely.

-- 2. ADD UNIQUE CONSTRAINT ON PHONE
-- Required for Supabase UPSERT (.upsert) logic to work properly
ALTER TABLE public.patients 
  ADD CONSTRAINT patients_phone_key UNIQUE (phone);

-- Note: If this fails with 'could not create unique index', it means 
-- you already have duplicate phones in your database. 
-- You must manually delete or alter duplicate phone entries first!
