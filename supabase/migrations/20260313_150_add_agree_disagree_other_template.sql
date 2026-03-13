-- Add "Agree / Disagree / Other" response template
-- Same as the existing Agree/Disagree/Comment template but with "Other" instead of "Comment"

INSERT INTO response_templates (name, options)
VALUES ('Agree / Disagree / Other', ARRAY['Agree', 'Disagree', 'Other'])
ON CONFLICT (name) DO NOTHING;
