import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyCertificate } from './my-certificate';

describe('MyCertificate', () => {
  let component: MyCertificate;
  let fixture: ComponentFixture<MyCertificate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyCertificate],
    }).compileComponents();

    fixture = TestBed.createComponent(MyCertificate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
