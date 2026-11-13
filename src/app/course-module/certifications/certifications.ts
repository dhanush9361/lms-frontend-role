
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface CertificateImage {
  id: number;
  src: string;
  alt: string;
}

@Component({
  selector: 'app-certificate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './certifications.html',
  styleUrl: './certifications.css'
})
export class CertificateComponent {

  selectedImage: number = 1;

  currentDate: string = new Date().toLocaleDateString('en-GB');

 
certificateImages: CertificateImage[] = [
  {
    id: 1,
    src: '/imgcomponent/certifications/classroom.png',
    alt: 'Classroom'
  },
  {
    id: 2,
    src: '/imgcomponent/certifications/Training%20session.png',
    alt: 'Training session'
  },
  {
    id: 3,
    src: '/imgcomponent/certifications/Business%20training.png',
    alt: 'Business training'
  },
  {
    id: 4,
    src: '/imgcomponent/certifications/Lecture%20hall.png',
    alt: 'Lecture hall'
  }
];

  get selectedCertificateImage(): string {
    const image = this.certificateImages.find(
      (item: CertificateImage) => item.id === this.selectedImage
    );

    return image?.src ?? this.certificateImages[0].src;
  }

  selectImage(image: CertificateImage): void {
    this.selectedImage = image.id;
  }

  downloadCertificate(): void {
    window.print();
  }
}
