import '@testing-library/jest-dom/vitest';

// Mock import.meta.env defaults
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_ADMIN_PASSWORD: '',
  },
  writable: true,
  configurable: true,
});
