-- New lead-source channels (PG 12+ allows ADD VALUE in a transaction; values aren't used in this migration).
ALTER TYPE "Channel" ADD VALUE IF NOT EXISTS 'GOOGLE_ADS';
ALTER TYPE "Channel" ADD VALUE IF NOT EXISTS 'LINKEDIN';
