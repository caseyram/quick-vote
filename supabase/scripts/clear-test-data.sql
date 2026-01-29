-- Clear all test sessions, questions, and votes (respects foreign key order)
DELETE FROM votes;
DELETE FROM questions;
DELETE FROM sessions;
