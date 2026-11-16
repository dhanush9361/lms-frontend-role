/**
 * Certificate template model + tag engine.
 *
 * The admin designs the certificate once and writes TAGS such as {{learner_name}} in the text.
 * When a certificate is generated later (after the learner completes every section) the SAME
 * `resolveTags()` below replaces each tag with the real value - so the designer preview and the
 * generated certificate can never disagree.
 */

export type CertificateTagKey =
  | 'learner_name'
  | 'course_name'
  | 'completion_date'
  | 'organization_name'
  | 'certificate_id';

export interface CertificateTagDef {
  readonly key: CertificateTagKey;
  /** Friendly name shown on the chip. */
  readonly label: string;
  /** What the tag is replaced with when the certificate is generated. */
  readonly hint: string;
  /** Sample value used by the designer preview. */
  readonly sample: string;
}

export const CERTIFICATE_TAGS: readonly CertificateTagDef[] = [
  { key: 'learner_name', label: 'Learner Name', hint: "The learner's full name", sample: 'Priya Ramesh' },
  { key: 'course_name', label: 'Course Name', hint: 'Title of the completed course', sample: 'Advanced Project Management' },
  { key: 'completion_date', label: 'Completion Date', hint: 'Date the course was completed', sample: '16 November 2026' },
  { key: 'organization_name', label: 'Organization', hint: 'Name of the issuing organization', sample: 'VativaHub Academy' },
  { key: 'certificate_id', label: 'Certificate ID', hint: 'Unique certificate number', sample: 'CERT-2026-000123' },
];

/** Tags that every certificate must contain somewhere, otherwise it would not identify anyone. */
export const REQUIRED_TAG_KEYS: readonly CertificateTagKey[] = ['learner_name', 'course_name'];

export type CertificateFont = 'classic' | 'elegant' | 'modern';
export type CertificateBorder = 'double' | 'single' | 'none';
export type CertificateLogoPosition = 'left' | 'center' | 'right';

export interface CertificateTemplate {
  title: string;
  subtitle: string;
  /** Main paragraph. May contain tags. */
  body: string;
  /** Small line at the bottom centre, e.g. "Certificate ID: {{certificate_id}}". May contain tags. */
  footerNote: string;
  /** Small caption under the date, e.g. "Date of Completion". */
  dateLabel: string;
  /** Text above the date line. May contain tags (normally {{completion_date}}). */
  dateText: string;
  signatoryName: string;
  signatoryTitle: string;
  /** Hex colour used for the border and headings. */
  accent: string;
  /** Certificate background colour (hex). */
  background: string;
  /** Optional background picture as a data URL (null = none). Drawn over the background colour. */
  backgroundImage: string | null;
  font: CertificateFont;
  border: CertificateBorder;
  /** Organization logo as a data URL (null = no logo). */
  logo: string | null;
  /** Where the logo sits across the top of the certificate. */
  logoPosition: CertificateLogoPosition;
  /** Signature image as a data URL (null = none). */
  signature: string | null;
}

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
  title: 'Certificate of Completion',
  subtitle: 'This is to certify that',
  body:
    '{{learner_name}}\nhas successfully completed the course\n{{course_name}}\non {{completion_date}}.',
  footerNote: 'Certificate ID: {{certificate_id}}',
  dateLabel: 'Date of Completion',
  dateText: '{{completion_date}}',
  signatoryName: 'Authorized Signatory',
  signatoryTitle: '{{organization_name}}',
  accent: '#2f7684',
  background: '#ffffff',
  backgroundImage: null,
  font: 'classic',
  border: 'double',
  logo: null,
  logoPosition: 'center',
  signature: null,
};

export const CERTIFICATE_LOGO_POSITIONS: readonly { id: CertificateLogoPosition; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

export const CERTIFICATE_FONTS: readonly { id: CertificateFont; label: string; family: string }[] = [
  { id: 'classic', label: 'Classic (Playfair Display)', family: "'Playfair Display', Georgia, serif" },
  { id: 'elegant', label: 'Elegant (Lora)', family: "Lora, Georgia, serif" },
  { id: 'modern', label: 'Modern (Poppins)', family: "Poppins, 'Segoe UI', sans-serif" },
];

export const CERTIFICATE_BACKGROUNDS: readonly { hex: string; label: string }[] = [
  { hex: '#ffffff', label: 'White' },
  { hex: '#fdf8ec', label: 'Cream' },
  { hex: '#eef6f8', label: 'Light teal' },
  { hex: '#f3f4f6', label: 'Light grey' },
  { hex: '#fff7ed', label: 'Peach' },
];

export const CERTIFICATE_ACCENTS: readonly { hex: string; label: string }[] = [
  { hex: '#2f7684', label: 'Teal' },
  { hex: '#1e3a8a', label: 'Navy' },
  { hex: '#7f1d1d', label: 'Maroon' },
  { hex: '#166534', label: 'Green' },
  { hex: '#78350f', label: 'Bronze' },
  { hex: '#374151', label: 'Charcoal' },
];

// ---------------------------------------------------------------------------------------------
// Tag engine
// ---------------------------------------------------------------------------------------------

const TAG_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

const TAG_BY_KEY: ReadonlyMap<string, CertificateTagDef> = new Map(
  CERTIFICATE_TAGS.map((tag) => [tag.key, tag]),
);

/** One piece of a text: plain text, or a known tag. */
export interface TextSegment {
  readonly text: string;
  readonly tag: CertificateTagDef | null;
}

/** Splits `text` into plain-text and tag segments (unknown tags stay as plain text). */
export function tokenize(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(TAG_PATTERN)) {
    const tag = TAG_BY_KEY.get(match[1].toLowerCase());
    if (!tag) continue;
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), tag: null });
    segments.push({ text: match[0], tag });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), tag: null });
  return segments;
}

/** Replaces every known tag in `text` with its value. Tags without a value are left untouched. */
export function resolveTags(text: string, values: Partial<Record<CertificateTagKey, string>>): string {
  return text.replace(TAG_PATTERN, (whole, key: string) => {
    const tag = TAG_BY_KEY.get(key.toLowerCase());
    return (tag && values[tag.key]) ?? whole;
  });
}

/** Tag-like words in `text` that are not real tags, e.g. {{learner}} - usually a typo. */
export function findUnknownTags(text: string): string[] {
  const unknown = new Set<string>();
  for (const match of text.matchAll(TAG_PATTERN)) {
    if (!TAG_BY_KEY.has(match[1].toLowerCase())) unknown.add(match[0]);
  }
  return [...unknown];
}

/** Every text field of the template that can hold tags. */
export function templateTexts(template: Pick<CertificateTemplate, 'title' | 'subtitle' | 'body' | 'footerNote' | 'dateLabel' | 'dateText' | 'signatoryName' | 'signatoryTitle'>): string[] {
  return [
    template.title,
    template.subtitle,
    template.body,
    template.footerNote,
    template.dateLabel,
    template.dateText,
    template.signatoryName,
    template.signatoryTitle,
  ];
}

/** Required tags (learner name, course name) that are missing from the whole template. */
export function findMissingRequiredTags(template: CertificateTemplate): CertificateTagDef[] {
  const used = new Set<CertificateTagKey>();
  for (const text of templateTexts(template)) {
    for (const segment of tokenize(text)) {
      if (segment.tag) used.add(segment.tag.key);
    }
  }
  return REQUIRED_TAG_KEYS.filter((key) => !used.has(key)).map((key) => TAG_BY_KEY.get(key)!);
}