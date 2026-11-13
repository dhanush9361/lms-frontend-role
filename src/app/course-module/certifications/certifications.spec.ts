
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CertificateComponent } from '../certifications/certifications';

describe('CertificateComponent', () => {

  let component: CertificateComponent;
  let fixture: ComponentFixture<CertificateComponent>;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [CertificateComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have four certificate images', () => {
    expect(component.certificateImages.length).toBe(4);
  });

  it('should select the clicked certificate image', () => {

    component.selectImage(component.certificateImages[1]);

    expect(component.selectedImage).toBe(2);
  });

  it('should return the selected certificate background', () => {

    component.selectedImage = 3;

    expect(component.selectedCertificateImage)
      .toBe('/assets/certificates/certificate-3.png');
  });

  it('should display First Name and Last Name as design text', () => {

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('First Name Last Name');
  });

});
