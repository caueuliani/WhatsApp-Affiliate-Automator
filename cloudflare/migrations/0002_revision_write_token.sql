-- Version-checked writes: nonce is an ownership marker for a single D1 batch.
-- Existing revisions remain intact; no backup/offer data is deleted.
ALTER TABLE operator_revisions ADD COLUMN write_token TEXT;
