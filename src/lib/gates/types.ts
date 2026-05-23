import type { TranslationKey } from '../../i18n';

export type GateReason = {
  titleKey: TranslationKey | string;
  descriptionKey?: TranslationKey | string;
};

export type GateDecision =
  | { allowed: true }
  | { allowed: false; reason: GateReason };

export function deny(reason: GateReason): GateDecision {
  return { allowed: false, reason };
}
