import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertificateDesigner } from './certificate-designer';

describe('CertificateDesigner', () => {
  let component: CertificateDesigner;
  let fixture: ComponentFixture<CertificateDesigner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateDesigner],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateDesigner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});