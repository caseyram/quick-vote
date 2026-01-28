import { vi } from 'vitest';

// Build a chainable query builder mock
export function createQueryBuilder(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in',
    'order', 'limit', 'single', 'maybeSingle',
    'range', 'filter', 'match', 'not', 'or', 'contains',
    'textSearch', 'is',
  ];

  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods resolve
  builder.then = vi.fn().mockImplementation((resolve) => resolve(resolvedValue));

  // Make it thenable (Promise-like)
  const proxy = new Proxy(builder, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(resolvedValue);
      }
      return target[prop as string] ?? vi.fn().mockReturnValue(proxy);
    },
  });

  return proxy;
}

// Default mock for supabase client
export const mockSupabase = {
  from: vi.fn().mockReturnValue(createQueryBuilder()),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
    unsubscribe: vi.fn(),
    track: vi.fn(),
    send: vi.fn(),
  }),
  removeChannel: vi.fn(),
};

// Setup the module mock — call this in test setup or vi.mock
export function setupSupabaseMock() {
  vi.mock('../../lib/supabase', () => ({
    supabase: mockSupabase,
  }));
}
