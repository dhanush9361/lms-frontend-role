import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactUs } from './contact-us';

describe('ContactUs', () => {

  let component: ContactUs;
  let fixture: ComponentFixture<ContactUs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactUs]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactUs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display heading', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain("Let's Talk...");
  });

  it('should display name input', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[name="name"]')).toBeTruthy();
  });

  it('should display location input', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[name="location"]')).toBeTruthy();
  });

  it('should display phone input', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[name="phone"]')).toBeTruthy();
  });

  it('should display send button', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('should initialize contact details', () => {
    expect(component.contact.name).toBe('');
    expect(component.contact.location).toBe('');
    expect(component.contact.phone).toBe('');
  });

  it('should initialize submitted as false', () => {
    expect(component.submitted).toBe(false);
  });

});