
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacyPolicy } from './privacy-policy';

describe('PrivacyPolicy', () => {
  let component: PrivacyPolicy;
  let fixture: ComponentFixture<PrivacyPolicy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPolicy],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPolicy);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display Privacy Policy heading', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Privacy And');
    expect(element.textContent).toContain('Policy');
  });
});
