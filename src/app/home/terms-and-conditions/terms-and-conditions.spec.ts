import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TermsAndConditions } from './terms-and-conditions';

describe('TermsAndConditions', () => {
  let component: TermsAndConditions;
  let fixture: ComponentFixture<TermsAndConditions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsAndConditions],
    }).compileComponents();

    fixture = TestBed.createComponent(TermsAndConditions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display Terms & Conditions heading', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Terms & Conditions');
  });
});