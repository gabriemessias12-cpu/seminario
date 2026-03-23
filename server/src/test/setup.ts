// Set JWT secrets before any module that reads them at load time
process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-for-vitest';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-vitest';
