ALTER TABLE sessions ADD COLUMN reasons_enabled boolean DEFAULT false;
ALTER TABLE votes ADD COLUMN reason text;
