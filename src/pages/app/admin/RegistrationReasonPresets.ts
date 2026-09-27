import type { Language } from '../../../lib/api/languages';
import type { ResolveUserRequestAction } from '../../../lib/api/requests';

export type ApplicantMessageLanguage = 'cs' | 'en';
export type RegistrationReasonAction = Extract<ResolveUserRequestAction, 'deny' | 'request_correction'>;

const reasons = {
  address_nonexistent: {
    action: 'deny',
    cs: 'Přihlášku zamítáme, protože uvedená adresa neexistuje.',
    en: 'We are rejecting your application because the address provided does not exist.',
  },
  application_incorrect: {
    action: 'deny',
    cs: 'Přihlášku zamítáme, protože není korektně vyplněná.',
    en: 'We are rejecting your application because it has not been filled in correctly.',
  },
  duplicate_application: {
    action: 'deny',
    cs: 'Tuto přihlášku zamítáme, protože se jedná o duplicitní přihlášku.',
    en: 'We are rejecting this application because it is a duplicate.',
  },
  existing_membership: {
    action: 'deny',
    cs: 'Přihlášku zamítáme, protože již máš členství ve vpsFree.cz. Použij prosím svůj stávající účet.',
    en: 'We are rejecting your application because you are already a vpsFree.cz member. Please use your existing account.',
  },
  address_incomplete: {
    action: 'request_correction',
    cs: 'Doplň prosím úplnou adresu: ulici (pokud existuje), číslo domu, obec, PSČ a zemi.',
    en: 'Please provide your complete address: street (if applicable), house number, town or city, postal code and country.',
  },
  address_unverified: {
    action: 'request_correction',
    cs: 'Uvedenou adresu se nám nepodařilo ověřit. Zkontroluj ji prosím a případně oprav nebo doplň. Můžeš nám také poslat odkaz na mapu, na které bude označen tvůj dům.',
    en: 'We could not verify the address provided. Please check it and correct or complete it if needed. You can also send us a link to a map with your house marked.',
  },
  name_incomplete: {
    action: 'request_correction',
    cs: 'V přihlášce chybí jméno nebo není úplné. Doplň prosím své celé jméno a příjmení.',
    en: 'Your name is missing or incomplete in the application. Please provide your full first and last name.',
  },
} as const;

export type RegistrationReasonKey = keyof typeof reasons;

export function registrationReasonPresets(action: RegistrationReasonAction) {
  return (Object.keys(reasons) as RegistrationReasonKey[]).filter(key => reasons[key].action === action);
}

export function registrationReasonText(action: RegistrationReasonAction, key: string, language: ApplicantMessageLanguage): string | null {
  if (!Object.hasOwn(reasons, key)) return null;
  const preset = reasons[key as RegistrationReasonKey];
  return preset.action === action ? preset[language] : null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function applicantLanguageId(language: unknown): number | undefined {
  const raw = record(language)?.['id'] ?? language;
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** Never infer language from a deployment-specific numeric ID or the admin UI. */
export function applicantMessageLanguage(language: unknown, catalog: Language[] = []): ApplicantMessageLanguage | null {
  const id = applicantLanguageId(language);
  const data = record(language);
  const known = catalog.find(item => item.id === id);
  const code = String(data?.['code'] ?? known?.code ?? (typeof language === 'string' ? language : '')).trim().toLowerCase().replaceAll('_', '-');
  if (/^(cs|cz)(-|$)/.test(code)) return 'cs';
  if (/^en(-|$)/.test(code)) return 'en';
  const label = String(data?.['label'] ?? known?.label ?? '').trim().toLowerCase();
  if (['čeština', 'česky', 'czech'].includes(label)) return 'cs';
  if (['english', 'anglicky', 'angličtina'].includes(label)) return 'en';
  return null;
}
