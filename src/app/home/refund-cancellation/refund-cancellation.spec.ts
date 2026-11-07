
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RefundCancellation } from './refund-cancellation';

describe('RefundCancellation', () => {
  let component: RefundCancellation;
  let fixture: ComponentFixture<RefundCancellation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefundCancellation],
    }).compileComponents();

    fixture = TestBed.createComponent(RefundCancellation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display Refund And Cancellation Policy heading', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Refund And');
    expect(element.textContent).toContain('Cancellation Policy');
  });
});
