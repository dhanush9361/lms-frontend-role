import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { CertificateTemplate, DEFAULT_CERTIFICATE_TEMPLATE } from '../certificate-module/certificate.model';
import { ApiResponse } from '../course-module/course.model';

/** One row of My Certificate. */
export interface MyCertificateItem {
  id: number;
  courseId: number;
  courseName: string;
  certificateNumber: string;
  /** ISO date-time: the day the course was completed. */
  issuedAt: string;
}

/** What the API sends for one certificate: the tag values and the organization's design (null = never saved). */
interface MyCertificateDetailApi {
  id: number;
  courseId: number;
  courseName: string;
  learnerName: string;
  organizationName: string | null;
  certificateNumber: string;
  issuedAt: string;
  template: (Partial<CertificateTemplate> & { updatedAt?: string }) | null;
}

/** Everything the screen needs to draw one certificate. */
export interface MyCertificateDetail {
  id: number;
  courseName: string;
  learnerName: string;
  organizationName: string;
  certificateNumber: string;
  issuedAt: string;
  template: CertificateTemplate;
}

/** The certificates the logged-in learner has earned (GET /api/my-certificates). */
@Injectable({ providedIn: 'root' })
export class MyCertificateService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/my-certificates`;

  list(): Observable<MyCertificateItem[]> {
    return this.http.get<ApiResponse<MyCertificateItem[]>>(this.url).pipe(map((res) => res.data ?? []));
  }

  get(id: number): Observable<MyCertificateDetail> {
    return this.http.get<ApiResponse<MyCertificateDetailApi>>(`${this.url}/${id}`).pipe(
      map((res) => {
        const d = res.data;
        return {
          id: d.id,
          courseName: d.courseName,
          learnerName: d.learnerName,
          organizationName: d.organizationName ?? '',
          certificateNumber: d.certificateNumber,
          issuedAt: d.issuedAt,
          template: this.toTemplate(d.template),
        };
      }),
    );
  }

  /** The organization's design; any missing field (or no saved design at all) falls back to the default design. */
  private toTemplate(t: Partial<CertificateTemplate> | null): CertificateTemplate {
    const d = DEFAULT_CERTIFICATE_TEMPLATE;
    if (!t) return d;
    return {
      title: t.title ?? d.title,
      subtitle: t.subtitle ?? d.subtitle,
      body: t.body ?? d.body,
      footerNote: t.footerNote ?? d.footerNote,
      dateLabel: t.dateLabel ?? d.dateLabel,
      dateText: t.dateText ?? d.dateText,
      signatoryName: t.signatoryName ?? d.signatoryName,
      signatoryTitle: t.signatoryTitle ?? d.signatoryTitle,
      accent: t.accent ?? d.accent,
      background: t.background ?? d.background,
      backgroundImage: t.backgroundImage ?? null,
      font: t.font ?? d.font,
      border: t.border ?? d.border,
      logo: t.logo ?? null,
      logoPosition: t.logoPosition ?? d.logoPosition,
      signature: t.signature ?? null,
    };
  }
}