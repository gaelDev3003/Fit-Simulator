import { createClient, User, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client with 'fit' as default schema
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'fit' },
});

// Helper function for explicit fit schema operations (simplified since schema is already default)
export const createFitSchemaClient = () => {
  return {
    from: (table: string) => supabase.from(table),
    rpc: (fn: string, args?: any, options?: any) =>
      supabase.rpc(fn, args, options),
  };
};

// Type-safe fit schema client
export const fitClient = createFitSchemaClient();

// For auth and storage operations (schema not relevant)
export const supabaseAuth = supabase.auth;
export const supabaseStorage = supabase.storage;

// Admin client for server-side operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Re-export types for convenience
export type { User, Session };
