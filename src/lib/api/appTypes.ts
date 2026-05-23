/**
 * Shared types used by the legacy `api/app.ts` aggregator.
 *
 * NOTE: Prefer importing from the domain modules directly (users, vps, nodes,…).
 * The `app.ts` file remains for backwards compatibility.
 */

export interface ResourceRef {
  id: number;
  label?: string;
  name?: string;
  [k: string]: unknown;
}

export interface Location {
  id: number;
  label?: string;
  description?: string;
  remote_console_server?: string;
  domain?: string;
  [k: string]: unknown;
}
