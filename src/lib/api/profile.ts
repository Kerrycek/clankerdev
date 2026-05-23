// Backwards-compatible re-export.
//
// NOTE: The implementation lives in userDossier.ts so we can share the same
// API wrappers across /profile/* and /admin/users/:id/* pages.

export * from './userDossier';
