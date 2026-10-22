-- Data-only migration: BASIC_CHECK_REASON_SEED_DATA is only applied when an event is created, so
-- backfill the new "Revision requested" warning onto every existing event. ON CONFLICT skips any
-- event where an admin already added a REVISION_REQUESTED row by hand.
INSERT INTO "basic_check_reasons" ("id", "code", "label", "description", "level", "eventId", "isActive")
SELECT
    gen_random_uuid()::text,
    'REVISION_REQUESTED',
    'Revision requested',
    'Reviewer requested changes before approval',
    'WARNING',
    "id",
    true
FROM "events"
ON CONFLICT ("eventId", "code") DO NOTHING;
