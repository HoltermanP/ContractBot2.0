-- Cleanup legacy contract management tables after backfill to new hierarchy.
-- Run only after validating that all consumers use the new model.

DROP TABLE IF EXISTS notifications_log CASCADE;
DROP TABLE IF EXISTS notification_rules CASCADE;
DROP TABLE IF EXISTS approval_workflows CASCADE;
DROP TABLE IF EXISTS contract_access CASCADE;
DROP TABLE IF EXISTS contract_obligations CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS contract_documents CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS custom_fields CASCADE;
DROP TABLE IF EXISTS dashboard_notifications CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

