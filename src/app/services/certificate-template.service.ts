import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { CertificateTemplate, DEFAULT_CERTIFICATE_TEMPLATE } from '../certificate-module/certificate.model';
import { ApiResponse } from '../course-module/course.model';

/** What the API returns: the design plus when it was last saved. */
type CertificateTemplateApi = CertificateTemplate & { updatedAt?: string };

/**
 * The certificate design of the admin's organization, stored in the database
 * (GET / PUT /api/certificate-template, company admin only). One design per organization.
 */
@Injectable({ providedIn: 'root' })
export class CertificateTemplateService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/certificate-template`;

  /** The saved design, or the blank default design when nothing has been saved yet. */
  load(): Observable<CertificateTemplate> {
    return this.http
      .get<ApiResponse<CertificateTemplateApi | null>>(this.url)
      .pipe(map((res) => (res.data ? this.fromApi(res.data) : DEFAULT_CERTIFICATE_TEMPLATE)));
  }

  /** Creates the design the first time and replaces it afterwards. Emits the design as saved. */
  save(template: CertificateTemplate): Observable<CertificateTemplate> {
    return this.http
      .put<ApiResponse<CertificateTemplateApi>>(this.url, template)
      .pipe(map((res) => this.fromApi(res.data)));
  }

  /** Picks the design fields (drops updatedAt) and fills anything the server left out with the defaults. */
  private fromApi(data: CertificateTemplateApi): CertificateTemplate {
    const d = DEFAULT_CERTIFICATE_TEMPLATE;
    return {
      title: data.title ?? d.title,
      subtitle: data.subtitle ?? d.subtitle,
      body: data.body ?? d.body,
      footerNote: data.footerNote ?? d.footerNote,
      dateLabel: data.dateLabel ?? d.dateLabel,
      dateText: data.dateText ?? d.dateText,
      signatoryName: data.signatoryName ?? d.signatoryName,
      signatoryTitle: data.signatoryTitle ?? d.signatoryTitle,
      accent: data.accent ?? d.accent,
      background: data.background ?? d.background,
      backgroundImage: data.backgroundImage ?? null,
      font: data.font ?? d.font,
      border: data.border ?? d.border,
      logo: data.logo ?? null,
      logoPosition: data.logoPosition ?? d.logoPosition,
      signature: data.signature ?? null,
    };
  }
}