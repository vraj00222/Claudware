import "@testing-library/jest-dom/vitest";

// Force the Redis adapter into its in-memory fallback for unit tests (mirrors CI, where REDIS_URL is
// unset) so tests are deterministic and never touch a live Redis even when one is configured locally.
delete process.env.REDIS_URL;
