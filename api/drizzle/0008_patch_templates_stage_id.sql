ALTER TABLE patch_templates ADD COLUMN stage_id UUID REFERENCES stages(id) ON DELETE CASCADE;
CREATE INDEX patch_templates_stage_id_idx ON patch_templates(stage_id);
