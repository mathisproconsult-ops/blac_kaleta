// Logique de vérification d'âge partagée entre la barrière au niveau
// catégorie (age-gate.tsx, mémorisée par cookie car décidée côté serveur)
// et la barrière au clic sur une œuvre individuelle +18 (lightbox-gallery,
// mémorisée en localStorage car décidée entièrement côté client). Ce n'est
// pas une vérification d'identité : une date de naissance déclarée peut
// toujours être fausse, comme sur la plupart des sites.

export function isValidBirthDate(day: number, month: number, year: number): boolean {
  if (!day || !month || !year) return false;
  const parsed = new Date(year, month - 1, day);
  const isReal =
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  return isReal && parsed <= new Date();
}

export function isAdultAge(day: number, month: number, year: number): boolean {
  const today = new Date();
  const hadBirthdayThisYear =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  const age = today.getFullYear() - year - (hadBirthdayThisYear ? 0 : 1);
  return age >= 18;
}

const ITEM_VERIFICATION_STORAGE_KEY = "blac-kaleta-age-verified-until";
const ITEM_VERIFICATION_DAYS = 30;

// Enveloppé en try/catch : le localStorage peut être indisponible (navigation
// privée, réglages navigateur) — dans ce cas, la vérification est simplement
// redemandée à chaque œuvre plutôt que de faire planter la page.
export function isAgeVerifiedInStorage(): boolean {
  try {
    const until = window.localStorage.getItem(ITEM_VERIFICATION_STORAGE_KEY);
    return until !== null && Number(until) > Date.now();
  } catch {
    return false;
  }
}

export function markAgeVerifiedInStorage(): void {
  try {
    const until = Date.now() + ITEM_VERIFICATION_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(ITEM_VERIFICATION_STORAGE_KEY, String(until));
  } catch {
    // Rien à faire : la vérification sera simplement redemandée la prochaine fois.
  }
}
