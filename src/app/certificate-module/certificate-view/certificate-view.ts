import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';

import {
  CERTIFICATE_FONTS,
  CertificateTagKey,
  CertificateTemplate,
  tokenize,
} from '../certificate.model';

interface Piece {
  readonly text: string;
  readonly key: CertificateTagKey | null;
}

/**
 * One finished certificate (A4 landscape) drawn from the organization's design and one learner's values.
 *
 * Used for the learner's Preview and for the PDF download. Every size is a plain px value worked out from
 * `width` (1 unit = 1 % of the width), so it looks the same at any size and can be captured as an image.
 * The design is the same one the admin sees in the certificate designer.
 */
@Component({
  selector: 'app-certificate-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.display]': '"block"',
    '[style.position]': '"relative"',
    '[style.overflow]': '"hidden"',
    '[style.width.px]': 'width()',
    '[style.height.px]': 'height()',
    '[style.color]': '"#333333"',
    '[style.box-shadow]': '"0 2px 14px rgba(0,0,0,0.15)"',
    '[style.font-family]': 'fontFamily()',
    '[style.background-color]': 'template().background',
    '[style.background-image]': 'backgroundImageCss()',
    '[style.background-size]': '"cover"',
    '[style.background-position]': '"center"',
  },
  templateUrl: './certificate-view.html',
  imports: [NgTemplateOutlet],
})
export class CertificateView {
  /** The organization's design. */
  readonly template = input.required<CertificateTemplate>();
  /** Real values for the {{tags}} (learner name, course name, date, ...). */
  readonly values = input.required<Partial<Record<CertificateTagKey, string>>>();
  /** Width in px. The height follows the A4 landscape ratio. */
  readonly width = input<number>(1000);

  /** The certificate element itself (what the PDF download captures). */
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly height = computed(() => this.width() / 1.4142);
  /** 1 % of the width, in px. */
  private readonly unit = computed(() => this.width() / 100);

  protected readonly fontFamily = computed(
    () => CERTIFICATE_FONTS.find((f) => f.id === this.template().font)?.family ?? CERTIFICATE_FONTS[0].family,
  );
  protected readonly backgroundImageCss = computed(() => {
    const image = this.template().backgroundImage;
    return image ? `url("${image}")` : 'none';
  });
  protected readonly borderCss = computed(() => {
    const { border, accent } = this.template();
    if (border === 'double') return `${(this.unit() * 1.1).toFixed(2)}px double ${accent}`;
    if (border === 'single') return `${(this.unit() * 0.35).toFixed(2)}px solid ${accent}`;
    return 'none';
  });
  protected readonly logoJustify = computed(() => {
    const p = this.template().logoPosition;
    return p === 'left' ? 'flex-start' : p === 'right' ? 'flex-end' : 'center';
  });
  protected readonly bodyLines = computed(() => this.template().body.split('\n'));

  /** The line above the date / signature. */
  protected readonly rule = computed(() => `${Math.max(1, this.unit() * 0.12).toFixed(2)}px solid #555555`);

  /** The learner name and course name stand out, like in the designer. */
  protected readonly learnerStyle = computed(() => ({
    display: 'block',
    'font-size': this.px(4.2),
    'font-weight': '700',
    'line-height': '1.15',
    'overflow-wrap': 'anywhere',
    color: this.template().accent,
  }));
  protected readonly courseStyle = computed(() => ({
    display: 'block',
    'font-size': this.px(2.5),
    'font-weight': '700',
    'line-height': '1.3',
    'overflow-wrap': 'anywhere',
  }));

  /** n % of the width as px. */
  protected px(n: number): string {
    return `${(n * this.unit()).toFixed(2)}px`;
  }

  /** Splits a text into plain pieces and tags, with every tag replaced by its real value. */
  protected pieces(text: string): Piece[] {
    const values = this.values();
    return tokenize(text).map((segment) => ({
      text: segment.tag ? (values[segment.tag.key] ?? segment.text) : segment.text,
      key: segment.tag?.key ?? null,
    }));
  }
}