import {
  UploadCategory,
  UploadConstraint,
  ValidationError,
  UploadValidationResult,
  FileUploadMetadata,
} from '@/types/custom';

// Upload constraints configuration
export const UPLOAD_CONSTRAINTS: UploadConstraint = {
  person: { min: 1, max: 1 },
  items: { min: 0, max: 3 },
  noDuplicates: true,
};

// File constraints
export const FILE_CONSTRAINTS = {
  maxSize: 5 * 1024 * 1024, // 5MB soft limit
  hardMaxSize: 8 * 1024 * 1024, // 8MB hard limit
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
} as const;

/**
 * Validates a single file against size and type constraints
 */
export function validateFile(file: File): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check file type
  if (!FILE_CONSTRAINTS.allowedTypes.includes(file.type as any)) {
    errors.push({
      field: 'file',
      message:
        '지원하지 않는 파일 형식입니다. JPG, PNG 파일만 업로드 가능합니다.',
      code: 'INVALID_FILE_TYPE',
    });
  }

  // Check file size (hard limit)
  if (file.size > FILE_CONSTRAINTS.hardMaxSize) {
    errors.push({
      field: 'file',
      message: '파일 크기가 너무 큽니다. 8MB 이하의 파일만 업로드 가능합니다.',
      code: 'FILE_SIZE_EXCEEDED',
    });
  }

  return errors;
}

/**
 * Validates category constraints for a list of uploaded files
 */
export function validateCategoryConstraints(
  files: FileUploadMetadata[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  const personCount = files.filter((f) => f.category === 'person').length;
  const itemCount = files.filter((f) => f.category === 'item').length;

  // Check person count constraints
  if (personCount < UPLOAD_CONSTRAINTS.person.min) {
    errors.push({
      field: 'person',
      message: `최소 ${UPLOAD_CONSTRAINTS.person.min}개의 인물 사진이 필요합니다.`,
      code: 'CATEGORY_LIMIT_EXCEEDED',
    });
  }

  if (personCount > UPLOAD_CONSTRAINTS.person.max) {
    errors.push({
      field: 'person',
      message: `인물 사진은 최대 ${UPLOAD_CONSTRAINTS.person.max}개까지만 업로드 가능합니다.`,
      code: 'CATEGORY_LIMIT_EXCEEDED',
    });
  }

  // Check item count constraints
  if (itemCount > UPLOAD_CONSTRAINTS.items.max) {
    errors.push({
      field: 'items',
      message: `아이템 사진은 최대 ${UPLOAD_CONSTRAINTS.items.max}개까지만 업로드 가능합니다.`,
      code: 'CATEGORY_LIMIT_EXCEEDED',
    });
  }

  return errors;
}

/**
 * Validates the entire upload set
 */
export function validateUpload(
  files: FileUploadMetadata[]
): UploadValidationResult {
  const errors: ValidationError[] = [];

  // Validate each file individually
  for (const file of files) {
    const fileErrors = validateFile(file.file);
    errors.push(...fileErrors);
  }

  // Validate category constraints
  const categoryErrors = validateCategoryConstraints(files);
  errors.push(...categoryErrors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Determines the appropriate category for a new file based on existing files
 */
export function determineCategory(
  existingFiles: FileUploadMetadata[]
): UploadCategory {
  const personCount = existingFiles.filter(
    (f) => f.category === 'person'
  ).length;
  return personCount === 0 ? 'person' : 'item';
}

/**
 * Checks if adding a new file would violate constraints
 */
export function canAddFile(
  existingFiles: FileUploadMetadata[],
  newFile: File
): { canAdd: boolean; errors: ValidationError[] } {
  // Check file constraints
  const fileErrors = validateFile(newFile);
  if (fileErrors.length > 0) {
    return { canAdd: false, errors: fileErrors };
  }

  // Determine category for new file
  const category = determineCategory(existingFiles);
  const newFileMetadata: FileUploadMetadata = {
    id: '', // Will be set when actually adding
    file: newFile,
    category,
    preview: '', // Will be set when actually adding
    size: newFile.size,
    uploadedAt: new Date(),
  };

  // Check if adding this file would violate constraints
  const testFiles = [...existingFiles, newFileMetadata];
  const categoryErrors = validateCategoryConstraints(testFiles);

  if (categoryErrors.length > 0) {
    return { canAdd: false, errors: categoryErrors };
  }

  return { canAdd: true, errors: [] };
}
