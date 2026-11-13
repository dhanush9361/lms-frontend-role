
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyCertificateComponent } from './my-certificate';

describe('MyCertificateComponent', () => {

  let component: MyCertificateComponent;
  let fixture: ComponentFixture<MyCertificateComponent>;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [MyCertificateComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MyCertificateComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display My Certificate heading', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent)
      .toContain('My Certificate');
  });

  it('should display certificate records', () => {
    expect(component.certificates.length).toBe(9);
  });

  it('should display course names', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Cyber security');
    expect(compiled.textContent).toContain('UI/UX Designing');
  });

  it('should display issue dates', () => {
    expect(component.certificates[0].issueDate)
      .toBe('05-11-2026');
  });

});
