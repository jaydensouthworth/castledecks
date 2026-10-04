# Deletion-aware recovery, schema2

Configuration is deliberately incomplete until an operator chooses a policy and initializes an independent journal. Zero/omitted policy values are rejected. The example file cannot activate recovery. No real user data or credentials were used to build or test this mechanism.

## Commit ordering

1. Under the store's deletion lock, validate the independently stored journal and append the internal random account ID, deletion time and next sequence. The journal uses SQLite DELETE journaling and synchronous FULL. Its initial directory entry is also synced. Each record extends a SHA256 chain.
2. Commit that journal transaction before deleting the live account. Live foreign-key cascades remove saves and sessions. A failure/cancellation before the journal commit cannot acknowledge deletion. A failure after the journal commit leaves a deletion intent; session/save access checks the journal and refuses the affected account even if its old primary row still exists.
3. On startup, require the same journal identity and replay every retained intent in a primary transaction before serving accounts. Sign-in also reconciles pending intents before creating a fresh account. A deleted identity that signs in again receives a new internal account ID and no old documents.

Schema2 adds a journal binding and prevents schema1 binaries from silently opening the database. The actual game document formats and client-reported trust boundary are unchanged. Main database schema1→2 migration is transactional but operationally requires a planned upgrade and preserved recovery copy; the old binary cannot be the rollback strategy afterward.

## Policy and limits

Required JSON fields: backupHours (1–8760), tombstoneHours (at least backupHours+24, at most17520), maxRecords (1–100000). These are technical bounds, not a selected user retention policy. Policy is immutable for a journal in this slice: a different policy cannot be supplied silently. A policy migration needs a separate tested procedure.

Restoration rejects future timestamps, backups older than the chosen backup lifetime and backups older than the retained journal floor. Explicit pruning only removes a contiguous prefix beyond the tombstone horizon after first reconciling all retained deletions into the primary store. It preserves the chain floor and updates the required checkpoint. Capacity exhaustion stops new deletion acknowledgements with an error rather than silently dropping records. Operators must monitor capacity and execute approved pruning/physical backup expiry. The tool enforces recovery eligibility; it does not schedule deletion of files in an external backup system.

A separate named volume is only a separate path, not a separate failure domain. Keep the authoritative journal outside the account snapshots being recovered and preserve a current journal checkpoint independently. Back up/replicate that journal and checkpoint through a concrete approved storage process. Losing both current journal and checkpoint means recovery must remain unavailable. Local FULL sync does not protect against a disk/controller lying about durability or a whole-machine loss.

## Operator commands

The image includes `/app/recoveryctl`. Every command requires `-policy PATH -journal PATH`. Initialization is explicit and refuses to overwrite an existing file. Server startup opens an existing journal; it never recreates a lost one. Mounted secret paths are unrelated to these non-secret policy/checkpoint files.

- `-command init`: initialize a new journal after the policy/storage decision. Returns its checkpoint.
- `-command anchor`: validate and export the current journal checkpoint. Preserve its provenance outside the backup being restored. A value copied from an old backup is insufficient.
- `-command backup -db LIVE -output NEW_BACKUP -service-stopped`: requires an existing schema2 source, reconciles the journal, takes a consistent SQLite copy, strips sessions/login attempts, validates integrity, and returns backup metadata including hash. Save this metadata beside the new file without overwriting prior metadata.
- `-command restore -input BACKUP -output NEW_CANDIDATE -metadata BACKUP_JSON -expected-anchor CURRENT_ANCHOR_JSON -service-stopped`: verifies identity, exact current checkpoint, retention, content hash and schema; applies retained tombstones; strips all sessions; emits another quarantined file and metadata. Neither input nor live database is replaced.
- `-command prepare -input CANDIDATE -output NEW_PREPARED -metadata CANDIDATE_JSON -expected-anchor CURRENT_ANCHOR_JSON -service-stopped`: rechecks the latest journal and retention, reconciles again and creates a new file eligible for startup. It still does not replace the live volume. Startup must again open the original journal and replay deletions that happened after preparation.
- `-command prune -db LIVE -expected-anchor CURRENT_ANCHOR_JSON -service-stopped`: performs explicit bounded pruning and returns the new checkpoint to preserve.

The service-stopped switch records an operator assertion; it cannot verify the external orchestrator is stopped. CLI operations have a30second context, SQLite busy waits are3seconds, and all outputs use exclusive new-file publication. Underlying filesystem stalls are an OS/storage limitation. Raw backups and reconciled candidates contain a quarantine marker, so accidentally configuring either as the live database fails startup. A final prepared file still needs an explicit operator volume replacement with service stopped and the correct journal mounted.

## Failure behavior and practical limits

An unavailable, replaced, invalid or wrong-identity journal fails closed. Hash links/checkpoints detect corruption and rollback relative to a genuinely current checkpoint; these are not signatures and cannot authenticate a maliciously replaced journal plus forged checkpoint. File identity checks catch a journal path removed/replaced while its old SQLite connection remains open. The operational trust boundary is private, controlled storage and a verified current checkpoint.

A backup and journal copied together at the same old time do not prove recovery safety. If current checkpoint provenance is uncertain, do not restore. Keep the candidate quarantined and make a separate recovery decision, potentially starting an empty account store and asking players to upload local exports. New account sign-in is not authorization to resurrect deleted cloud data.

Tests use synthetic data and deterministic SQLite trigger failures at the journal-before-primary boundary, database/journal reopen, concurrent backup/deletion, revoked sessions, delete/recreate, deletion after preparation, expiry, stale and rolled-back checkpoints, wrong binding, corruption, missing paths, capacity/pruning, and CLI backup→quarantine→prepare→restart. These are functionality tests, not production storage qualification or an independent review. Docker/Nginx/provider/browser acceptance remains separate.
