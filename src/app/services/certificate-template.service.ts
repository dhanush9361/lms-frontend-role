import { Injectable } from '@angular/core';

import {
  CertificateTemplate,
  DEFAULT_CERTIFICATE_TEMPLATE,
} from '../certificate-module/certificate.model';

const STORAGE_KEY = 'lms.certificateTemplate.draft.v2';

/**
 * Stores the certificate template.
 *
 * TEMPORARY: the design page is built first, so the template is kept in this browser's
 * localStorage. When the Spring Boot API + database are ready, replace `load()` / `save()` with
 * HttpClient calls (GET / PUT) - the page itself does not need to change.
 */
@Injectable({ providedIn: 'root' })
export class CertificateTemplateService {
  load(): CertificateTemplate {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_CERTIFICATE_TEMPLATE;
      const saved = JSON.parse(raw) as Partial<CertificateTemplate>;
      // Merge over the defaults so a template saved by an older version never misses a field.
      return { ...DEFAULT_CERTIFICATE_TEMPLATE, ...saved };
    } catch {
      return DEFAULT_CERTIFICATE_TEMPLATE;
    }
  }

  /** Returns false when the browser refuses (for example the images are too large for localStorage). */
  save(template: CertificateTemplate): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
      return true;
    } catch {
      return false;
    }
  }
}