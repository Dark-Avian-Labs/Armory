import { createCatalogSchema } from './catalogSchema.js';
import { createUserSchema } from './userSchema.js';

export function createAppSchema(): void {
  createCatalogSchema();
  createUserSchema();
}

export { createCatalogSchema } from './catalogSchema.js';
export { createUserSchema } from './userSchema.js';
