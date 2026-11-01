import type { AccessibleChild } from '../alexa-child-directory.service';

/**
 * Which child a voice command refers to (ALX-9).
 *
 * Order: a spoken name always wins (and never silently falls back to the
 * default when it matches nothing); otherwise the link's default child, if the
 * user can still reach it; otherwise the only child; otherwise ask back.
 */
export type ChildResolution =
  | { kind: 'resolved'; child: AccessibleChild }
  | { kind: 'noChildren' }
  | { kind: 'notFound'; spokenName: string; candidates: AccessibleChild[] }
  | { kind: 'ambiguous'; candidates: AccessibleChild[] };

export function resolveChild(
  children: readonly AccessibleChild[],
  spokenName: string | undefined,
  defaultChildId: string | null,
): ChildResolution {
  if (children.length === 0) {
    return { kind: 'noChildren' };
  }

  if (spokenName !== undefined) {
    const matches = matchChildrenByName(children, spokenName);
    if (matches.length === 1) return { kind: 'resolved', child: matches[0] };
    if (matches.length > 1) return { kind: 'ambiguous', candidates: matches };
    return { kind: 'notFound', spokenName, candidates: [...children] };
  }

  const defaultChild = defaultChildId
    ? children.find((child) => child.id === defaultChildId)
    : undefined;
  if (defaultChild) return { kind: 'resolved', child: defaultChild };

  if (children.length === 1) return { kind: 'resolved', child: children[0] };
  return { kind: 'ambiguous', candidates: [...children] };
}

/**
 * Lower-cased, accent-free, letters only. Speech recognition is inconsistent
 * about "Zoë"/"Zoe", "Jürgen"/"Juergen" and stray punctuation; names in the
 * app are typed by hand.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Diacritics folded *without* the German umlaut transliteration, so "Zoë" ≈ "Zoe" too. */
function foldOnly(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Children whose name best matches what was said, or none. Exact matches on
 * the full or first name win outright (with a German/English possessive "s"
 * tolerated: "Emmas Windel", "Emma's day"); otherwise a small edit distance is
 * allowed for recognizer slips ("Mia"/"Mya"), scaled to the name's length.
 */
export function matchChildrenByName(
  children: readonly AccessibleChild[],
  spokenName: string,
): AccessibleChild[] {
  const spokenVariants = variantsOf(spokenName);
  if (spokenVariants.length === 0) return [];

  let best = Number.POSITIVE_INFINITY;
  let matches: AccessibleChild[] = [];

  for (const child of children) {
    const score = scoreChild(child.name, spokenVariants);
    if (score < best) {
      best = score;
      matches = [child];
    } else if (score === best) {
      matches.push(child);
    }
  }

  return Number.isFinite(best) ? matches : [];
}

function variantsOf(spoken: string): string[] {
  const variants = new Set<string>();
  for (const base of [normalizeName(spoken), foldOnly(spoken)]) {
    if (!base) continue;
    variants.add(base);
    // Possessive: "emmas" → "emma".
    if (base.endsWith('s') && base.length > 2) variants.add(base.slice(0, -1));
  }
  return [...variants];
}

/** 0 = exact, 1..n = edit distance, Infinity = no match. */
function scoreChild(childName: string, spokenVariants: readonly string[]): number {
  const targets = new Set<string>();
  for (const base of [normalizeName(childName), foldOnly(childName)]) {
    if (!base) continue;
    targets.add(base);
    targets.add(base.split(' ')[0]);
  }

  let best = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    for (const spoken of spokenVariants) {
      if (target === spoken) return 0;
      const distance = levenshtein(target, spoken);
      const allowed = target.length <= 4 ? 1 : 2;
      if (distance <= allowed && distance < best) best = distance;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}
