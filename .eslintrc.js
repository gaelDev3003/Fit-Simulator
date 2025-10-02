module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Enforce fitClient usage for database operations
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'CallExpression[callee.object.name="supabase"][callee.property.name="from"]',
        message:
          'Use fitClient.from() instead of supabase.from() for database operations. Import fitClient from @/lib/supabase.',
      },
      {
        selector:
          'CallExpression[callee.object.name="supabase"][callee.property.name="rpc"]',
        message:
          'Use fitClient.rpc() instead of supabase.rpc() for database operations. Import fitClient from @/lib/supabase.',
      },
    ],
    // Allow supabase.auth and supabase.storage usage
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@supabase/supabase-js'],
            message:
              'Import from @/lib/supabase instead. Use fitClient for database operations, supabaseAuth for auth, supabaseStorage for storage.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        // Additional TypeScript-specific rules
        'no-unused-vars': 'error',
      },
    },
    {
      files: ['src/lib/supabase.ts'],
      rules: {
        // Allow direct supabase-js import in supabase.ts only
        'no-restricted-imports': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
