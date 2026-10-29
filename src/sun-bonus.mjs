/** Only count a verified automatic sun sweep; never infer collection from sun balance. */
export function verifiedSunPickupCount(receipt, requested) {
  if (receipt?.status !== 'verified' || !Number.isInteger(requested) || requested < 1) return 0;
  const batch = receipt.batch;
  if (!batch) return requested;
  if (batch.requested !== requested || batch.scopeStopped || !Number.isInteger(batch.verified)
      || batch.verified < 0 || batch.verified > requested || batch.attempted !== batch.released
      || batch.attempted !== batch.verified || batch.verified + batch.stale !== requested) return 0;
  return batch.verified;
}
