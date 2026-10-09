import { UPLOAD_LIMITS } from '@trafaret/core';

const MEGABYTE = 1024 * 1024;

/** Why the server would refuse this file — checked before uploading. Null when the file looks fine. */
export function uploadProblem(file: File): string | null {
  if (!UPLOAD_LIMITS.mimeTypes.some((type) => type === file.type)) {
    return 'Only PNG, JPEG and WebP images are supported.';
  }
  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return `Images must be ${UPLOAD_LIMITS.maxBytes / MEGABYTE} MB or smaller.`;
  }
  return null;
}
