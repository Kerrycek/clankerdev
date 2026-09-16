export function shouldCancelIpAddressLookup(
  lookupSearchParamsSignature: string | null,
  currentSearchParamsSignature: string
): boolean {
  return (
    lookupSearchParamsSignature !== null &&
    lookupSearchParamsSignature !== currentSearchParamsSignature
  );
}
