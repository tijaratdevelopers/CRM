-- New lead statuses required by the distribution spec. Run BEFORE
-- migration_02_teams_round_robin.sql (added enum values cannot be used in the
-- same transaction that adds them).
alter type lead_status_enum add value if not exists 'quotation_sent';
alter type lead_status_enum add value if not exists 'duplicate';
alter type lead_status_enum add value if not exists 'invalid';
