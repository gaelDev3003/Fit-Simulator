// Custom types for Fit Simulator

// Upload category constraints
export type UploadCategory = 'person' | 'item';

export interface UploadConstraint {
  person: { min: 1; max: 1 };
  items: { min: 0; max: 3 };
  noDuplicates: true;
}

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  code:
    | 'INVALID_CATEGORY'
    | 'DUPLICATE_CATEGORY'
    | 'CATEGORY_LIMIT_EXCEEDED'
    | 'FILE_SIZE_EXCEEDED'
    | 'INVALID_FILE_TYPE'
    | 'TOO_MANY_ITEMS'
    | 'PERSON_REQUIRED'
    | 'UPLOAD_ERROR'
    | 'PERMISSION_DENIED'
    | 'NETWORK_ERROR';
}

// Upload validation result
export interface UploadValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// File upload metadata
export interface FileUploadMetadata {
  id: string;
  file: File;
  category: UploadCategory;
  preview: string;
  size: number;
  uploadedAt: Date;
}

// Storage paths
export interface StoragePaths {
  person: string;
  items: string[];
  preview: string;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Additional custom types can be added here
