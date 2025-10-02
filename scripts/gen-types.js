#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Generating Supabase TypeScript types...');

try {
  // Ensure types directory exists
  const typesDir = 'src/types';
  if (!fs.existsSync(typesDir)) {
    fs.mkdirSync(typesDir, { recursive: true });
  }

  // Generate types for both fit and public schemas to generated file
  const command = `npx supabase gen types typescript --schema fit,public --project-id hwqdwfwyumbvunbgqcyj > src/types/generated.supabase.ts`;

  console.log('Running:', command);
  execSync(command, { stdio: 'inherit' });

  // Create custom types file if it doesn't exist
  const customTypesPath = 'src/types/custom.ts';
  if (!fs.existsSync(customTypesPath)) {
    const customTypes = `// Custom types for Fit Simulator
export interface Job {
  id: string;
  user_id: string;
  app_id: 'fit';
  person_path: string;
  item_paths: string[];
  pose_id?: string;
  preview_path?: string;
  created_at: string;
}

export interface PosePreset {
  id: string;
  name: string;
  thumbnail_url: string;
  openpose_data: any;
}

// Additional custom types can be added here
`;

    fs.writeFileSync(customTypesPath, customTypes);
    console.log('📁 Created custom types file: src/types/custom.ts');
  }

  // Create or update index.ts to re-export both
  const indexContent = `// Re-export generated Supabase types
export * from './generated.supabase';

// Re-export custom types
export * from './custom';
`;

  fs.writeFileSync('src/types/index.ts', indexContent);

  console.log('✅ TypeScript types generated successfully!');
  console.log('📁 Generated types: src/types/generated.supabase.ts');
  console.log('📁 Custom types: src/types/custom.ts');
  console.log('📁 Index file: src/types/index.ts');
} catch (error) {
  console.error('❌ Error generating types:', error.message);
  process.exit(1);
}
