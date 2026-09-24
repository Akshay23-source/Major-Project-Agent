// Runs before any module is loaded in each test file.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing-000000';
process.env.MARKETPLACE_API_KEY = 'test-marketplace-key';
process.env.MARKETPLACE_DEFAULT_AGENT_EMAIL = 'agent@test.local';
process.env.SYNC_WORKER_ENABLED = 'false';
// MARKETPLACE_API_URL is set per test file (points at a fake marketplace server).
