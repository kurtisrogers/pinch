import type { DevFinding, PageContext } from "../types.js";
import { finding } from "../page-context.js";

interface ClassUsage {
  classString: string;
  tokens: string[];
  count: number;
  samples: string[];
}

const INTERACTIVE_SELECTOR =
  'button, [role="button"], a[class*="btn"], a[class*="button"], input[type="submit"], input[type="button"]';

const COMPONENT_TAGS = new Set([
  "article",
  "section",
  "nav",
  "header",
  "footer",
  "aside",
  "li",
  "div",
  "a",
  "button",
]);

export function analyzeCssConsistency(ctx: PageContext): DevFinding[] {
  const { doc } = ctx;
  const findings: DevFinding[] = [];

  findings.push(...findRepeatedClassPatterns(doc));
  findings.push(...findVerboseInteractiveClasses(doc));
  findings.push(...findSimilarClassGroups(doc));
  findings.push(...findStructuralClusters(doc));
  findings.push(...findNamingInconsistencies(doc));
  findings.push(...findUtilityFrameworkSmells(doc));

  if (findings.length === 0) {
    findings.push(
      finding(
        "css-consistency-ok",
        "css-consistency",
        "info",
        "No obvious class duplication patterns",
        "HTML class usage looks reasonably DRY from this page snapshot.",
      ),
    );
  }

  return findings;
}

function findRepeatedClassPatterns(doc: Document): DevFinding[] {
  const byExact = new Map<string, ClassUsage>();

  for (const el of doc.querySelectorAll("[class]")) {
    const classString = normalizeClassString(el.getAttribute("class") ?? "");
    if (!classString) continue;

    const entry = byExact.get(classString) ?? {
      classString,
      tokens: classString.split(" "),
      count: 0,
      samples: [],
    };
    entry.count++;
    if (entry.samples.length < 3) {
      entry.samples.push(describeElement(el));
    }
    byExact.set(classString, entry);
  }

  const repeats = [...byExact.values()]
    .filter((u) => u.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (repeats.length === 0) return [];

  const detail = repeats
    .map((r) => `${r.count}× "${truncate(r.classString, 70)}" e.g. ${r.samples.join(", ")}`)
    .join("\n");

  return [
    finding(
      "css-repeat-classes",
      "css-consistency",
      "info",
      `${repeats.length} repeated class pattern(s) — component candidates`,
      "These exact class strings appear multiple times. Consider extracting a shared component or partial.",
      detail,
    ),
  ];
}

function findVerboseInteractiveClasses(doc: Document): DevFinding[] {
  const verbose: string[] = [];

  for (const el of doc.querySelectorAll(INTERACTIVE_SELECTOR)) {
    const tokens = tokenizeClasses(el.getAttribute("class") ?? "");
    if (tokens.length >= 6) {
      verbose.push(`${describeElement(el)} — ${tokens.length} classes: ${truncate(tokens.join(" "), 80)}`);
    }
  }

  if (verbose.length === 0) return [];

  return [
    finding(
      "css-verbose-buttons",
      "css-consistency",
      "warning",
      `${verbose.length} interactive element(s) with verbose class lists`,
      "Buttons and links with 6+ utility classes are hard to maintain. Extract a `.btn` / component class or use a design token.",
      verbose.slice(0, 10).join("\n"),
    ),
  ];
}

function findSimilarClassGroups(doc: Document): DevFinding[] {
  const usages = collectClassUsages(doc);
  const groups: Array<{ key: string; items: ClassUsage[] }> = [];

  for (let i = 0; i < usages.length; i++) {
    for (let j = i + 1; j < usages.length; j++) {
      const a = usages[i];
      const b = usages[j];
      if (a.classString === b.classString) continue;

      const similarity = jaccard(a.tokens, b.tokens);
      if (similarity >= 0.65 && a.tokens.length >= 3) {
        const key = [a.classString, b.classString].sort().join(" <> ");
        if (groups.some((g) => g.key === key)) continue;
        groups.push({ key, items: [a, b] });
      }
    }
  }

  if (groups.length === 0) return [];

  const detail = groups
    .slice(0, 6)
    .map((g) => {
      const [a, b] = g.items;
      const shared = a.tokens.filter((t) => b.tokens.includes(t)).join(" ");
      return `"${truncate(a.classString, 45)}" ≈ "${truncate(b.classString, 45)}" (shared: ${shared || "—"})`;
    })
    .join("\n");

  return [
    finding(
      "css-similar-classes",
      "css-consistency",
      "warning",
      `${groups.length} pair(s) of near-duplicate class lists`,
      "These elements share most utility classes but differ slightly — unify into one component variant.",
      detail,
    ),
  ];
}

function findStructuralClusters(doc: Document): DevFinding[] {
  const clusters = new Map<string, { count: number; samples: string[]; fingerprint: string }>();

  for (const el of doc.querySelectorAll([...COMPONENT_TAGS].join(","))) {
    if (!el.classList.length && el.children.length === 0) continue;

    const fingerprint = structureFingerprint(el);
    const entry = clusters.get(fingerprint) ?? { count: 0, samples: [], fingerprint };
    entry.count++;
    if (entry.samples.length < 3) {
      entry.samples.push(describeElement(el));
    }
    clusters.set(fingerprint, entry);
  }

  const repeats = [...clusters.values()]
    .filter((c) => c.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  if (repeats.length === 0) return [];

  const detail = repeats
    .map((c) => `${c.count}× ${c.fingerprint} — ${c.samples.join(", ")}`)
    .join("\n");

  return [
    finding(
      "css-struct-clusters",
      "css-consistency",
      "info",
      `${repeats.length} repeated DOM structure(s)`,
      "Same tag, classes, and child layout pattern — strong candidates for a card/list item component.",
      detail,
    ),
  ];
}

function findNamingInconsistencies(doc: Document): DevFinding[] {
  const tokens = new Set<string>();
  for (const el of doc.querySelectorAll("[class]")) {
    for (const t of tokenizeClasses(el.getAttribute("class") ?? "")) {
      tokens.add(t.toLowerCase());
    }
  }

  const buttonPrefixes = ["btn", "button", "cta"].filter((p) =>
    [...tokens].some((t) => t === p || t.startsWith(`${p}-`) || t.startsWith(`${p}_`)),
  );

  if (buttonPrefixes.length > 1) {
    return [
      finding(
        "css-naming-buttons",
        "css-consistency",
        "warning",
        "Mixed button naming conventions",
        `Found ${buttonPrefixes.map((p) => `.${p}-*`).join(", ")} style prefixes. Standardise on one pattern (e.g. BEM block \`btn\`).`,
      ),
    ];
  }

  const cardPrefixes = ["card", "tile", "panel", "box"].filter((p) =>
    [...tokens].some((t) => t === p || t.startsWith(`${p}-`)),
  );

  if (cardPrefixes.length > 1) {
    return [
      finding(
        "css-naming-cards",
        "css-consistency",
        "info",
        "Mixed container naming",
        `Both ${cardPrefixes.join(" and ")} patterns appear — consider one container primitive.`,
      ),
    ];
  }

  return [];
}

function findUtilityFrameworkSmells(doc: Document): DevFinding[] {
  const findings: DevFinding[] = [];
  let arbitraryCount = 0;
  let importantInClass = 0;

  for (const el of doc.querySelectorAll("[class]")) {
    const raw = el.getAttribute("class") ?? "";
    arbitraryCount += (raw.match(/\[[^\]]+\]/g) ?? []).length;
    if (/\b!?important\b/i.test(raw)) importantInClass++;
  }

  if (arbitraryCount > 8) {
    findings.push(
      finding(
        "css-arbitrary-values",
        "css-consistency",
        "warning",
        `${arbitraryCount} arbitrary utility values in class names`,
        "Many `[...]` / arbitrary Tailwind-style values suggest missing design tokens. Add spacing/color tokens to the theme.",
      ),
    );
  }

  if (importantInClass > 0) {
    findings.push(
      finding(
        "css-important-in-class",
        "css-consistency",
        "info",
        "important modifier in HTML classes",
        "Prefer source-order or specificity fixes in CSS instead of important utilities in markup.",
      ),
    );
  }

  return findings;
}

function collectClassUsages(doc: Document): ClassUsage[] {
  const map = new Map<string, ClassUsage>();

  for (const el of doc.querySelectorAll("[class]")) {
    const classString = normalizeClassString(el.getAttribute("class") ?? "");
    if (!classString || tokenizeClasses(classString).length < 3) continue;

    const entry = map.get(classString) ?? {
      classString,
      tokens: tokenizeClasses(classString),
      count: 0,
      samples: [],
    };
    entry.count++;
    map.set(classString, entry);
  }

  return [...map.values()].sort((a, b) => b.tokens.length - a.tokens.length).slice(0, 40);
}

function structureFingerprint(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes = tokenizeClasses(el.getAttribute("class") ?? "")
    .slice(0, 4)
    .join(".");
  const childShape = [...el.children]
    .slice(0, 4)
    .map((c) => c.tagName.toLowerCase())
    .join(">");
  return `<${tag}${classes ? `.${classes}` : ""}> [${childShape || "empty"}]`;
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = tokenizeClasses(el.getAttribute("class") ?? "")
    .slice(0, 2)
    .join(".");
  return `<${tag}${id}${cls ? `.${cls}` : ""}>`;
}

function normalizeClassString(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function tokenizeClasses(raw: string): string[] {
  return normalizeClassString(raw)
    .split(" ")
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}
