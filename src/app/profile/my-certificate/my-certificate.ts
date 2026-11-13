
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Certificate {
  id: number;
  courseName: string;
  issueDate: string;
  downloadUrl: string;
  fileName: string;
}

@Component({
  selector: 'app-certificate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-certificate.html'
})
export class MyCertificateComponent {

  certificates: Certificate[] = [
    {
      id: 1,
      courseName: 'Cyber security',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/cyber-security.pdf',
      fileName: 'Cyber-Security-Certificate.pdf'
    },
    {
      id: 2,
      courseName: 'UI/UX Designing',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/ui-ux.pdf',
      fileName: 'UI-UX-Certificate.pdf'
    },
    {
      id: 3,
      courseName: 'Cyber security',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/cyber-security.pdf',
      fileName: 'Cyber-Security-Certificate.pdf'
    },
    {
      id: 4,
      courseName: 'UI/UX Designing',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/ui-ux.pdf',
      fileName: 'UI-UX-Certificate.pdf'
    },
    {
      id: 5,
      courseName: 'Cyber security',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/cyber-security.pdf',
      fileName: 'Cyber-Security-Certificate.pdf'
    },
    {
      id: 6,
      courseName: 'UI/UX Designing',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/ui-ux.pdf',
      fileName: 'UI-UX-Certificate.pdf'
    },
    {
      id: 7,
      courseName: 'Cyber security',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/cyber-security.pdf',
      fileName: 'Cyber-Security-Certificate.pdf'
    },
    {
      id: 8,
      courseName: 'UI/UX Designing',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/ui-ux.pdf',
      fileName: 'UI-UX-Certificate.pdf'
    },
    {
      id: 9,
      courseName: 'Cyber security',
      issueDate: '05-11-2026',
      downloadUrl: 'assets/certificates/cyber-security.pdf',
      fileName: 'Cyber-Security-Certificate.pdf'
    }
  ];

  previewCertificate(certificate: Certificate): void {
    if (!certificate.downloadUrl) {
      return;
    }

    window.open(certificate.downloadUrl, '_blank');
  }

  goBack(): void {
    window.history.back();
  }

}
