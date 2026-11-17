import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertificateView } from './certificate-view';

describe('CertificateView', () => {
  let component: CertificateView;
  let fixture: ComponentFixture<CertificateView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateView],
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
