import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';

import { CertificateTemplateService } from '../../services/certificate-template.service';
import {
  CERTIFICATE_ACCENTS,
  CERTIFICATE_BACKGROUNDS,
  CERTIFICATE_FONTS,
  CERTIFICATE_LOGO_POSITIONS,
  CERTIFICATE_TAGS,
  CertificateBorder,
  CertificateFont,
  CertificateLogoPosition,
  CertificateTagDef,
  CertificateTagKey,
  CertificateTemplate,
  DEFAULT_CERTIFICATE_TEMPLATE,
  findMissingRequiredTags,
  findUnknownTags,
  templateTexts,
  tokenize,
} from '../certificate.model';

/** The form controls that hold text and can receive a tag. */
type TextControl =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'footerNote'
  | 'dateText'
  | 'dateLabel'
  | 'signatoryName'
  | 'signatoryTitle';

type ImageKind = 'logo' | 'signature' | 'background';
type ViewMode = 'design' | 'preview';

const FIELD_LABELS: Record<TextControl, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  body: 'Main text',
  footerNote: 'Footer note',
  dateText: 'Date',
  dateLabel: 'Date caption',
  signatoryName: 'Signatory name',
  signatoryTitle: 'Signatory designation',
};

const LOGO_JUSTIFY: Record<CertificateLogoPosition, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-certificate-designer',
  imports: [ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './certificate-designer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificateDesigner {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(CertificateTemplateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tags = CERTIFICATE_TAGS;
  readonly fonts = CERTIFICATE_FONTS;
  readonly accents = CERTIFICATE_ACCENTS;
  readonly backgrounds = CERTIFICATE_BACKGROUNDS;
  readonly logoPositions = CERTIFICATE_LOGO_POSITIONS;
  /** Shown in the help text (kept in code so Angular does not read the braces as an interpolation). */
  readonly exampleTag = '{{learner_name}}';

  private readonly initial = this.store.load();

  readonly form = this.fb.nonNullable.group({
    title: [this.initial.title],
    subtitle: [this.initial.subtitle],
    body: [this.initial.body],
    footerNote: [this.initial.footerNote],
    dateText: [this.initial.dateText],
    dateLabel: [this.initial.dateLabel],
    signatoryName: [this.initial.signatoryName],
    signatoryTitle: [this.initial.signatoryTitle],
    accent: [this.initial.accent],
    background: [this.initial.background],
    font: [this.initial.font as CertificateFont],
    border: [this.initial.border as CertificateBorder],
    // Older saved templates have no logoPosition, so fall back to centre.
    logoPosition: [(this.initial.logoPosition ?? 'center') as CertificateLogoPosition],
    // Only used by the preview - never saved.
    sampleName: [''],
    sampleCourse: [''],
    sampleDate: [''],
  });

  readonly logo = signal<string | null>(this.initial.logo);
  readonly signature = signal<string | null>(this.initial.signature);
  readonly backgroundImage = signal<string | null>(this.initial.backgroundImage);
  readonly mode = signal<ViewMode>('design');
  readonly previewing = computed(() => this.mode() === 'preview');

  readonly activeControl = signal<TextControl>('body');
  readonly activeLabel = computed(() => FIELD_LABELS[this.activeControl()]);

  readonly toast = signal<{ kind: 'success' | 'error'; message: string } | null>(null);
  readonly uploadError = signal<string | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private activeElement: HTMLInputElement | HTMLTextAreaElement | null = null;
  private caret: { start: number; end: number } | null = null;

  private readonly value = toSignal(
    this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  /** The template exactly as it will be saved. */
  readonly template = computed<CertificateTemplate>(() => {
    const v = this.value();
    return {
      title: v.title,
      subtitle: v.subtitle,
      body: v.body,
      footerNote: v.footerNote,
      dateText: v.dateText,
      dateLabel: v.dateLabel,
      signatoryName: v.signatoryName,
      signatoryTitle: v.signatoryTitle,
      accent: v.accent,
      background: v.background,
      backgroundImage: this.backgroundImage(),
      font: v.font,
      border: v.border,
      logo: this.logo(),
      logoPosition: v.logoPosition,
      signature: this.signature(),
    };
  });

  /** Each text split into plain / tag segments, ready for the preview. */
  readonly view = computed(() => {
    const t = this.template();
    return {
      title: tokenize(t.title),
      subtitle: tokenize(t.subtitle),
      bodyLines: t.body.split('\n').map((line) => tokenize(line)),
      footerNote: tokenize(t.footerNote),
      dateText: tokenize(t.dateText),
      dateLabel: tokenize(t.dateLabel),
      signatoryName: tokenize(t.signatoryName),
      signatoryTitle: tokenize(t.signatoryTitle),
    };
  });

  /** CSS value for the background picture ('none' when there is no picture). */
  readonly backgroundImageCss = computed(() => {
    const image = this.backgroundImage();
    return image ? `url("${image}")` : 'none';
  });

  readonly fontFamily = computed(
    () => this.fonts.find((f) => f.id === this.value().font)?.family ?? this.fonts[0].family,
  );

  readonly borderCss = computed(() => {
    const { border, accent } = this.value();
    if (border === 'double') return `1.1cqw double ${accent}`;
    if (border === 'single') return `0.35cqw solid ${accent}`;
    return 'none';
  });

  /** Tailwind justify class that puts the logo on the left, centre or right. */
  readonly logoJustify = computed(() => LOGO_JUSTIFY[this.value().logoPosition] ?? LOGO_JUSTIFY.center);

  readonly missingTags = computed(() => findMissingRequiredTags(this.template()));
  readonly unknownTags = computed(() => {
    const found = templateTexts(this.template()).flatMap((text) => findUnknownTags(text));
    return [...new Set(found)];
  });

  private readonly sampleValues = computed<Record<CertificateTagKey, string>>(() => {
    const v = this.value();
    // Nothing is pre-filled: what the admin types is shown, an empty field shows the tag's name.
    const label = (key: CertificateTagKey) => CERTIFICATE_TAGS.find((t) => t.key === key)!.label;
    const sample = (key: CertificateTagKey) => CERTIFICATE_TAGS.find((t) => t.key === key)!.sample;
    return {
      learner_name: v.sampleName.trim() || label('learner_name'),
      course_name: v.sampleCourse.trim() || label('course_name'),
      completion_date: v.sampleDate.trim() || label('completion_date'),
      organization_name: sample('organization_name'),
      certificate_id: sample('certificate_id'),
    };
  });

  // ---------- fit the designer to the screen (large screens only) ----------

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  /** Height in px that fills the screen from where the designer starts. null = natural height (small screens). */
  readonly fitHeight = signal<number | null>(null);

  private previousOverflow: { html: string; body: string } | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.toastTimer);
      this.unlockPageScroll();
    });

    afterNextRender(() => {
      this.fitToScreen();
      const onResize = () => this.fitToScreen();
      window.addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    });
  }

  /**
   * On large screens the designer is exactly as tall as the space under the app header, and the browser's
   * own page scrollbar is switched off while this page is open (it is restored when the page is left).
   * Measuring is more reliable than a fixed rem value, because the layout above can change.
   */
  private fitToScreen(): void {
    const element = this.root()?.nativeElement;
    if (!element || !window.matchMedia('(min-width: 1280px)').matches) {
      this.fitHeight.set(null);
      this.unlockPageScroll();
      return;
    }
    this.lockPageScroll();
    window.scrollTo(0, 0);
    const top = element.getBoundingClientRect().top;
    this.fitHeight.set(Math.max(480, Math.floor(window.innerHeight - top)));
  }

  private lockPageScroll(): void {
    if (this.previousOverflow) return;
    const html = document.documentElement;
    const body = document.body;
    this.previousOverflow = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
  }

  private unlockPageScroll(): void {
    if (!this.previousOverflow) return;
    document.documentElement.style.overflow = this.previousOverflow.html;
    document.body.style.overflow = this.previousOverflow.body;
    this.previousOverflow = null;
  }

  // ---------- preview helpers ----------

  sampleValue(key: CertificateTagKey): string {
    return this.sampleValues()[key];
  }

  /**
   * Learner name and course name stand out on the certificate; the other tags look like normal text.
   * The learner name takes the accent colour only in Preview (in Design the chip colour is used).
   */
  emphasis(key: CertificateTagKey): string {
    switch (key) {
      case 'learner_name':
        return (
          'block text-[4.2cqw] font-bold leading-tight [overflow-wrap:anywhere]' +
          (this.previewing() ? ' text-[color:var(--accent)]' : '')
        );
      case 'course_name':
        return 'block text-[2.5cqw] font-bold leading-snug [overflow-wrap:anywhere]';
      default:
        return '';
    }
  }

  setMode(mode: ViewMode): void {
    this.mode.set(mode);
  }

  // ---------- tag insertion ----------

  /** Remembers which field the admin is in and where the cursor is, so a tag can be inserted there. */
  rememberField(name: TextControl, event: Event): void {
    const element = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.activeControl.set(name);
    this.activeElement = element;
    this.caret = { start: element.selectionStart ?? element.value.length, end: element.selectionEnd ?? element.value.length };
  }

  insertTag(tag: CertificateTagDef): void {
    const name = this.activeControl();
    const control = this.form.controls[name];
    const text = control.value;
    const marker = `{{${tag.key}}}`;
    const start = Math.min(this.caret?.start ?? text.length, text.length);
    const end = Math.min(this.caret?.end ?? text.length, text.length);

    control.setValue(text.slice(0, start) + marker + text.slice(end));
    control.markAsDirty();

    const position = start + marker.length;
    this.caret = { start: position, end: position };
    const element = this.activeElement;
    if (element) {
      element.focus();
      element.setSelectionRange(position, position);
    }
  }

  // ---------- images ----------

  onImagePicked(kind: ImageKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be picked again later
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.uploadError.set('Please choose a PNG, JPG, WebP or SVG image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.uploadError.set('That image is larger than 2 MB. Please choose a smaller one.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return;
      this.imageSignal(kind).set(result);
      this.uploadError.set(null);
    };
    reader.onerror = () => this.uploadError.set('The image could not be read. Please try another file.');
    reader.readAsDataURL(file);
  }

  removeImage(kind: ImageKind): void {
    this.imageSignal(kind).set(null);
    this.uploadError.set(null);
  }

  private imageSignal(kind: ImageKind) {
    switch (kind) {
      case 'logo':
        return this.logo;
      case 'signature':
        return this.signature;
      case 'background':
        return this.backgroundImage;
    }
  }

  // ---------- reset ----------

  /** Back to the blank default design. Nothing is saved until the admin clicks Save. */
  reset(): void {
    const d = DEFAULT_CERTIFICATE_TEMPLATE;
    this.form.patchValue({
      title: d.title,
      subtitle: d.subtitle,
      body: d.body,
      footerNote: d.footerNote,
      dateText: d.dateText,
      dateLabel: d.dateLabel,
      signatoryName: d.signatoryName,
      signatoryTitle: d.signatoryTitle,
      accent: d.accent,
      background: d.background,
      font: d.font,
      border: d.border,
      logoPosition: d.logoPosition,
    });
    this.logo.set(d.logo);
    this.signature.set(d.signature);
    this.backgroundImage.set(d.backgroundImage);
    this.uploadError.set(null);
    this.flash('success', 'Design reset. Click Save template to keep it.');
  }

  // ---------- save ----------

  save(): void {
    const missing = this.missingTags();
    if (missing.length) {
      this.flash('error', `Add the ${missing.map((t) => t.label).join(' and ')} tag before saving.`);
      return;
    }
    if (this.unknownTags().length) {
      this.flash('error', `Fix the unknown tag ${this.unknownTags()[0]} before saving.`);
      return;
    }
    if (this.store.save(this.template())) {
      this.form.markAsPristine();
      this.flash('success', 'Certificate template saved.');
    } else {
      this.flash('error', 'The template could not be saved. Try smaller logo / signature images.');
    }
  }

  private flash(kind: 'success' | 'error', message: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ kind, message });
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}