export function shouldCancelIpAddressLookup(
  lookupSearchParamsSignature: string | null,
  currentSearchParamsSignature: string
): boolean {
  return (
    lookupSearchParamsSignature !== null &&
    lookupSearchParamsSignature !== currentSearchParamsSignature
  );
}

export function isIpAddressSmartFeedbackCurrent(
  feedbackSearchParamsSignature: string | null,
  currentSearchParamsSignature: string
): boolean {
  return (
    feedbackSearchParamsSignature !== null &&
    feedbackSearchParamsSignature === currentSearchParamsSignature
  );
}
