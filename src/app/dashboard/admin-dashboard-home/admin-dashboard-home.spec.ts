import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Course } from '../../course-module/course.model';
import { ApiRequestError, Enrollment } from '../../course-module/enrollment.model';
import { AuthService } from '../../services/auth';
import { CourseManagementService } from '../../services/course-management.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { AdminDashboardHome } from './admin-dashboard-home';

describe('AdminDashboardHome', () => {
  let component: AdminDashboardHome;
  let fixture: ComponentFixture<AdminDashboardHome>;
  let coursesSubject: Subject<Course[]>;
  let enrollmentResponses: Record<number, Observable<Enrollment[]>>;
  let canReadDashboardMetrics: boolean;
  let getAllCoursesCallCount: number;

  beforeEach(async () => {
    coursesSubject = new Subject<Course[]>();
    enrollmentResponses = {};
    canReadDashboardMetrics = true;
    getAllCoursesCallCount = 0;

    await TestBed.configureTestingModule({
      imports: [AdminDashboardHome],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ firstName: 'Maxx' }),
            displayName: () => 'Maxx Doe',
            can: () => canReadDashboardMetrics,
          },
        },
        {
          provide: CourseManagementService,
          useValue: {
            getAllCourses: () => {
              getAllCoursesCallCount += 1;
              return coursesSubject.asObservable();
            },
          },
        },
        {
          provide: EnrollmentService,
          useValue: {
            getEnrollments: (courseId: number) => enrollmentResponses[courseId] ?? of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardHome);
    component = fixture.componentInstance;
  });

  it('creates the dashboard inside the existing routed page', () => {
    expect(component).toBeTruthy();
  });

  it('uses the authenticated user name without a placeholder', () => {
    expect(component.userName()).toBe('Maxx');
  });

  it('keeps the existing period choices', () => {
    expect(component.selectedPeriod).toBe('');
    expect(component.timePeriods).toHaveLength(10);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select').textContent).toContain('Time Period');
  });

  it('updates the selected period without requesting a missing endpoint', () => {
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'Last 30 Days';
    select.dispatchEvent(new Event('change'));

    expect(component.selectedPeriod).toBe('Last 30 Days');
    expect(component.dashboardData).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Active Learners');
  });

  it('does not display fabricated values or dash placeholders when data is unavailable', () => {
    fixture.detectChanges();

    expect(component.formatNumber(null)).toBe('');
    expect(component.formatPercentage(undefined)).toBe('');
    expect(component.getRolePercentage('admins')).toBe('');
    expect(component.hasChartData('logins')).toBe(false);
    expect(component.hasChartData('newSignups')).toBe(false);
    expect(component.hasChartData('revenue')).toBe(false);
    expect(component.getCourseCompletionDisplay()).toBe('Loading...');
    expect(fixture.nativeElement.textContent).not.toContain('—');
    expect(fixture.nativeElement.textContent).toContain('No chart data available');
  });

  it('formats available numbers and percentages', () => {
    expect(component.formatNumber(1000)).toBe('1,000');
    expect(component.formatPercentage(60)).toBe('60%');
  });

  it('calculates completion rate from unique enrollment records across courses', () => {
    const sharedEnrollment = makeEnrollment(2, 'IN_PROGRESS');
    enrollmentResponses[1] = of([makeEnrollment(1, 'COMPLETED'), sharedEnrollment]);
    enrollmentResponses[2] = of([sharedEnrollment]);

    coursesSubject.next([makeCourse(1), makeCourse(2)]);

    expect(component.dashboardData?.courseCompletionRate).toBe(50);
    expect(component.courseCompletionState).toBe('ready');
    expect(component.getCourseCompletionDisplay()).toBe('50%');
  });

  it('uses every enrollment returned by the pagination-aware service', () => {
    enrollmentResponses[1] = of(
      Array.from({ length: 105 }, (_, index) =>
        makeEnrollment(index + 1, index < 100 ? 'COMPLETED' : 'IN_PROGRESS'),
      ),
    );

    coursesSubject.next([makeCourse(1)]);

    expect(component.dashboardData?.courseCompletionRate).toBe(95.2);
  });

  it('leaves completion rate empty when there are no enrollments', () => {
    coursesSubject.next([makeCourse(1)]);

    expect(component.dashboardData).toBeNull();
    expect(component.courseCompletionState).toBe('empty');
  });

  it('keeps the completion rate empty if any course enrollment request fails', () => {
    enrollmentResponses[1] = throwError(() => new Error('enrollment request failed'));
    coursesSubject.next([makeCourse(1)]);

    expect(component.dashboardData).toBeNull();
    expect(component.courseCompletionState).toBe('error');
  });

  it('keeps the completion rate unavailable when enrollment access is denied', () => {
    enrollmentResponses[1] = throwError(
      () => new ApiRequestError('You do not have permission', 403),
    );
    coursesSubject.next([makeCourse(1)]);

    expect(component.dashboardData).toBeNull();
    expect(component.courseCompletionState).toBe('unauthorized');
    expect(component.getCourseCompletionDisplay()).toBe('Not available');
  });

  it('does not request course data when the Admin lacks required read permissions', () => {
    fixture.destroy();
    canReadDashboardMetrics = false;
    getAllCoursesCallCount = 0;

    fixture = TestBed.createComponent(AdminDashboardHome);
    component = fixture.componentInstance;

    expect(component.courseCompletionState).toBe('unauthorized');
    expect(component.dashboardData).toBeNull();
    expect(getAllCoursesCallCount).toBe(0);
  });

  it('closes area paths at the chart baseline and keeps generated curve coordinates finite', () => {
    component.dashboardData = {
      logins: {
        total: 3,
        data: [
          { label: 'A', value: 0 },
          { label: 'B', value: 3000 },
          { label: 'C', value: 0 },
        ],
      },
    };

    expect(component.loginAreaPath.endsWith('L 590 300 L 55 300 Z')).toBe(true);
    expect(component.loginPath).not.toContain('NaN');
  });
});

function makeCourse(id: number): Course {
  return {
    id,
    name: `Course ${id}`,
    categoryId: 1,
    categoryName: 'Technical',
    instructorId: 1,
    instructorName: 'Instructor',
    level: 'BEGINNER',
    status: 'PUBLISHED',
    paid: false,
    price: 0,
    createdAt: '',
    updatedAt: '',
  };
}

function makeEnrollment(id: number, status: Enrollment['status']): Enrollment {
  return {
    id,
    userId: id,
    username: `Learner ${id}`,
    enrollmentDate: null,
    completionDate: null,
    expirationDate: null,
    progress: null,
    status,
    score: null,
    completion: null,
  };
}
