import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';

import { CertificateTagKey } from '../certificate.model';
import { MyCertificateDetail, MyCertificateItem, MyCertificateService } from '../../services/my-certificate.service';
import { CertificateView } from '../certificate-view/certificate-view';

/** A4 landscape at 96 dpi - the size the PDF is drawn at (then captured at 2x). */
const PDF_WIDTH_PX = 1123;
/** The preview never gets wider than this, even on very large screens. */
const PREVIEW_MAX_WIDTH_PX = 1400;
/** A4 landscape ratio (width / height). */
const A4_RATIO = 1.4142;

/**
 * Learner profile -> My Certificate: the certificates earned by completing courses.
 * Preview opens the certificate in the page itself (no popup), sized to fit the screen without scrolling.
 * Download saves it as a PDF.
 * The certificate is drawn from the organization's certificate design (set up by the admin).
 */
@Component({
  selector: 'app-my-certificate',
  imports: [DatePipe, CertificateView],
  templateUrl: './my-certificate.html',
  styleUrl: './my-certificate.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closePreview()',
    '(window:resize)': 'fitPreviewWidth()',
  },
})
export class MyCertificate implements OnInit {
  private readonly api = inject(MyCertificateService);

  protected readonly items = signal<MyCertificateItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // ---------- preview ----------
  protected readonly previewFor = signal<MyCertificateItem | null>(null);
  protected readonly previewDetail = signal<MyCertificateDetail | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly previewError = signal<string | null>(null);
  protected readonly previewWidth = signal(PREVIEW_MAX_WIDTH_PX);
  protected readonly previewValues = computed(() => {
    const d = this.previewDetail();
    return d ? this.valuesOf(d) : {};
  });

  // ---------- download ----------
  protected readonly downloadingId = signal<number | null>(null);
  protected readonly downloadError = signal<string | null>(null);
  /** The certificate drawn off-screen while its PDF is being made. */
  protected readonly pdfDetail = signal<MyCertificateDetail | null>(null);
  protected readonly pdfWidth = PDF_WIDTH_PX;
  protected readonly pdfValues = computed(() => {
    const d = this.pdfDetail();
    return d ? this.valuesOf(d) : {};
  });
  private readonly pdfView = viewChild<CertificateView>('pdfView');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.loadError.set(this.messageOf(error, 'Your certificates could not be loaded.'));
      },
    });
  }

  // ------------------------------------------------------------------
  // preview
  // ------------------------------------------------------------------

  protected openPreview(item: MyCertificateItem): void {
    this.previewFor.set(item);
    this.previewDetail.set(null);
    this.previewError.set(null);
    this.previewLoading.set(true);
    this.fitPreviewWidth();
    this.api.get(item.id).subscribe({
      next: (detail) => {
        this.previewDetail.set(detail);
        this.previewLoading.set(false);
      },
      error: (error) => {
        this.previewLoading.set(false);
        this.previewError.set(this.messageOf(error, 'The certificate could not be loaded.'));
      },
    });
  }

  protected closePreview(): void {
    this.previewFor.set(null);
  }

  /**
   * The biggest A4-landscape certificate that fits the page without any scrolling:
   * limited by the free width (sidebar + page padding taken off), by the free height
   * (header + title + padding taken off) and by PREVIEW_MAX_WIDTH_PX.
   */
  protected fitPreviewWidth(): void {
    const byWidth = window.innerWidth - 160;
    const byHeight = (window.innerHeight - 215) * A4_RATIO;
    this.previewWidth.set(Math.max(280, Math.min(PREVIEW_MAX_WIDTH_PX, byWidth, byHeight)));
  }

  // ------------------------------------------------------------------
  // download (PDF)
  // ------------------------------------------------------------------

  /** Makes a PDF of the certificate. The libraries are loaded only now, so the page itself stays light. */
  protected download(item: MyCertificateItem): void {
    if (this.downloadingId() !== null) return;
    this.downloadingId.set(item.id);
    this.downloadError.set(null);
    this.api.get(item.id).subscribe({
      next: (detail) => void this.makePdf(item, detail),
      error: (error) => {
        this.downloadingId.set(null);
        this.downloadError.set(this.messageOf(error, 'The certificate could not be downloaded.'));
      },
    });
  }

  private async makePdf(item: MyCertificateItem, detail: MyCertificateDetail): Promise<void> {
    try {
      // draw it off-screen at the PDF size and wait until it is on the page with its fonts and pictures
      this.pdfDetail.set(detail);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await document.fonts?.ready;
      await this.imagesLoaded();

      const host = this.pdfView()?.element.nativeElement;
      if (!host) throw new Error('certificate not drawn');

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
      const canvas = await html2canvas(host, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
      pdf.save(`Certificate - ${this.safeFileName(item.courseName)}.pdf`);
    } catch {
      this.downloadError.set('The certificate could not be downloaded. Please try again.');
    } finally {
      this.pdfDetail.set(null);
      this.downloadingId.set(null);
    }
  }

  /** Waits for the logo / signature / background pictures of the off-screen certificate. */
  private async imagesLoaded(): Promise<void> {
    const images = Array.from(this.pdfView()?.element.nativeElement.querySelectorAll('img') ?? []);
    await Promise.all(
      images.map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
      ),
    );
  }

  // ------------------------------------------------------------------

  /** The real values for the certificate's {{tags}}. */
  private valuesOf(d: MyCertificateDetail): Partial<Record<CertificateTagKey, string>> {
    return {
      learner_name: d.learnerName,
      course_name: d.courseName,
      completion_date: formatDate(d.issuedAt, 'd MMMM yyyy', 'en-US'),
      organization_name: d.organizationName,
      certificate_id: d.certificateNumber,
    };
  }

  private safeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Course';
  }

  private messageOf(error: { error?: { message?: string } } | undefined, fallback: string): string {
    return error?.error?.message || fallback;
  }
}