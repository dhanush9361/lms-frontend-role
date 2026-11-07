
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanPolicy } from './plan-policy';

describe('PlanPolicy', () => {
  let component: PlanPolicy;
  let fixture: ComponentFixture<PlanPolicy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanPolicy],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanPolicy);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display Pricing Policy heading', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Pricing Policy');
  });
});
