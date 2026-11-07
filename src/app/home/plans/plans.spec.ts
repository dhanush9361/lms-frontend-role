
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Plans } from './plans';

describe('Plans', () => {

  let component: Plans;
  let fixture: ComponentFixture<Plans>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Plans],
    }).compileComponents();

    fixture = TestBed.createComponent(Plans);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display page heading', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('h1')?.textContent
    ).toContain('Choose Your Perfect Plan');
  });

  it('should display monthly and yearly buttons', () => {
    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll('button'));

    expect(
      buttons.some(button => button.textContent?.trim() === 'Monthly')
    ).toBe(true);

    expect(
      buttons.some(button => button.textContent?.trim() === 'Yearly')
    ).toBe(true);
  });

  it('should initialize monthly billing', () => {
    expect(component.selectedBilling).toBe('monthly');
  });

  it('should change billing to yearly', () => {
    component.selectBilling('yearly');

    expect(component.selectedBilling).toBe('yearly');
  });

  it('should change billing to monthly', () => {
    component.selectBilling('yearly');
    component.selectBilling('monthly');

    expect(component.selectedBilling).toBe('monthly');
  });

  it('should display three sample plans', () => {
    expect(component.plans.length).toBe(3);
  });

  it('should select a plan', () => {
    component.buyPlan(component.plans[0]);

    expect(component.selectedPlan).toBe('Beginners Plan');
  });

  it('should clear selected plan when billing changes', () => {
    component.buyPlan(component.plans[0]);
    component.selectBilling('yearly');

    expect(component.selectedPlan).toBe('');
  });

  it('should display QR code image', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector(
        'img[alt="Annual subscription payment QR code"]'
      )
    ).toBeTruthy();
  });

});
