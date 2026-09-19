export interface UserNamespaceListProps {
  testIdPrefix: string;
  namespaceBase: string;
  mapsBase: string;
  /** Fixed owner for profile or another owner-specific view. */
  fixedUserId?: number;
  /** Show administrator columns; filter authorization is still role-checked. */
  showAdminFields?: boolean;
}

export interface UserNamespaceMapListProps {
  testIdPrefix: string;
  mapsBase: string;
  namespacesBase: string;
  /** Fixed owner for profile or another owner-specific view. */
  fixedUserId?: number;
  /** Show administrator columns; filter authorization is still role-checked. */
  showAdminFields?: boolean;
  /** Populate the create drawer's namespace selector from the index API. */
  createWithNamespaceSelect?: boolean;
}
