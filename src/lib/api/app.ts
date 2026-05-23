/**
 * Legacy API aggregator.
 *
 * Historically, the Next UI imported everything from `lib/api/app`.
 * The redesign splits the wrappers into domain modules (`users`, `vps`, `nodes`, …)
 * to keep the codebase maintainable.
 *
 * This file remains as a backwards-compatible barrel export for external compatibility.
 * Internal src/ code must import from the domain modules directly; see
 * `npm run audit:api-barrel-imports`.
 */

export * from './appTypes';
export * from './users';
export * from './clusterSearch';
export * from './nodes';
export * from './vps';
export * from './vpsMounts';
export * from './vpsFeatures';
export * from './vpsMaintenance';
export * from './networkInterfaces';
export * from './ipAddresses';
export * from './transactions';
export * from './actionStates';
export * from './migrations';
