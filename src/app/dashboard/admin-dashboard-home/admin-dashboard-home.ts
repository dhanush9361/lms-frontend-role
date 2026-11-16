import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiRequestError, Enrollment } from '../../course-module/enrollment.model';
import { AuthService, FEATURE } from '../../services/auth';
import { CourseManagementService } from '../../services/course-management.service';
import { EnrollmentService } from '../../services/enrollment.service';

interface ChartPoint {
  label: string;
  value: number;
}

interface CourseEnrollmentResult {
  error: unknown | null;
  enrollments: Enrollment[];
}

interface DashboardResponse {
  logins?: {
    total: number;
    data: ChartPoint[];
  };

  newSignups?: {
    total: number;
    data: ChartPoint[];
  };

  revenue?: {
    total: number;
    data: ChartPoint[];
  };

  averageLearningTime?: string;
  courseCompletionRate?: number;
  admins?: number;
  instructors?: number;
  learners?: number;
  onlineUsers?: number;
}

type RoleType = 'admins' | 'instructors' | 'learners';
type ChartType = 'logins' | 'newSignups' | 'revenue';
type CourseCompletionState = 'loading' | 'ready' | 'empty' | 'unauthorized' | 'error';

@Component({
  selector: 'app-admin-dashboard-home',
  imports: [CommonModule],
  templateUrl: './admin-dashboard-home.html',
  styleUrl: './admin-dashboard-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardHome {
  private readonly auth = inject(AuthService);
  private readonly coursesApi = inject(CourseManagementService);
  private readonly enrollmentsApi = inject(EnrollmentService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly userName = computed(
    () => this.auth.user()?.firstName?.trim() || this.auth.displayName(),
  );
  selectedPeriod = '';

  dashboardData: DashboardResponse | null = null;
  courseCompletionState: CourseCompletionState = 'loading';

  constructor() {
    this.loadDashboardData();
  }

  readonly timePeriods: string[] = [
    'Today',
    'Yesterday',
    'Week',
    'Month',
    'Last Week',
    'Last 30 Days',
    'Last 60 Days',
    'Last 90 Days',
    'Last 180 Days',
    'Last Year',
  ];

  readonly loginTicks = [3000, 2500, 2000, 1500, 1000, 500, 0];
  readonly revenueTicks = [18000, 15000, 12000, 9000, 6000, 3000, 0];

  private loadDashboardData(): void {
    if (
      !this.auth.can(FEATURE.COURSE_LIST, 'read') ||
      !this.auth.can(FEATURE.ENROLLED_LIST, 'read')
    ) {
      this.courseCompletionState = 'unauthorized';
      return;
    }

    this.coursesApi
      .getAllCourses()
      .pipe(
        catchError((error: unknown) => {
          console.error('Failed to load dashboard courses', error);
          this.courseCompletionState = this.isAuthorizationError(error)
            ? 'unauthorized'
            : 'error';
          return of(null);
        }),
        switchMap((courses) => {
          if (!courses?.length) {
            this.courseCompletionState = 'empty';
            return of(null);
          }

          const courseIds = [...new Set(courses.map((course) => course.id))];

          return forkJoin(
            courseIds.map((courseId) =>
              this.enrollmentsApi.getEnrollments(courseId).pipe(
                map(
                  (enrollments): CourseEnrollmentResult => ({
                    error: null,
                    enrollments,
                  }),
                ),
                catchError((error: unknown) => {
                  console.error(`Failed to load enrollments for course ${courseId}`, error);
                  return of({ error, enrollments: [] });
                }),
              ),
            ),
          ).pipe(
            map((results) => {
              const failures = results.filter((result) => result.error !== null);
              if (failures.length) {
                this.courseCompletionState = failures.some((result) =>
                  this.isAuthorizationError(result.error),
                )
                  ? 'unauthorized'
                  : 'error';
                return null;
              }

              const enrollments = new Map<number, Enrollment>();
              for (const result of results) {
                for (const enrollment of result.enrollments) {
                  enrollments.set(enrollment.id, enrollment);
                }
              }

              const uniqueEnrollments = [...enrollments.values()];
              if (!uniqueEnrollments.length) {
                this.courseCompletionState = 'empty';
                return null;
              }

              const completedCount = uniqueEnrollments.filter(
                (enrollment) => enrollment.status === 'COMPLETED',
              ).length;

              this.courseCompletionState = 'ready';
              return {
                courseCompletionRate: Number(
                  ((completedCount / uniqueEnrollments.length) * 100).toFixed(1),
                ),
              };
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((data) => {
        this.dashboardData = data;
        this.changeDetector.markForCheck();
      });
  }

  getCourseCompletionDisplay(): string {
    switch (this.courseCompletionState) {
      case 'loading':
        return 'Loading...';
      case 'unauthorized':
        return 'Not available';
      case 'error':
        return 'Unavailable';
      case 'empty':
        return '';
      case 'ready':
        return this.formatPercentage(this.dashboardData?.courseCompletionRate);
    }
  }

  private isAuthorizationError(error: unknown): boolean {
    if (
      (error instanceof ApiRequestError || error instanceof HttpErrorResponse) &&
      (error.status === 401 || error.status === 403)
    ) {
      return true;
    }

    return (
      error instanceof Error &&
      /\b(unauthorized|authentication is required|not authenticated|do not have permission|forbidden)\b/i.test(
        error.message,
      )
    );
  }

  onPeriodChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedPeriod = select.value;
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '';
    }

    return new Intl.NumberFormat('en-IN').format(value);
  }

  formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '';
    }

    return `${value}%`;
  }

  hasChartData(type: ChartType): boolean {
    const data = this.dashboardData?.[type]?.data;
    return !!data?.length;
  }

  get loginPath(): string {
    return this.createSmoothPath(this.dashboardData?.logins?.data ?? [], 3000);
  }

  get signupPath(): string {
    return this.createSmoothPath(this.dashboardData?.newSignups?.data ?? [], 3000);
  }

  get revenuePath(): string {
    return this.createSmoothPath(this.dashboardData?.revenue?.data ?? [], 18000);
  }

  get loginAreaPath(): string {
    return this.createAreaPath(this.dashboardData?.logins?.data ?? [], 3000);
  }

  get signupAreaPath(): string {
    return this.createAreaPath(this.dashboardData?.newSignups?.data ?? [], 3000);
  }

  get revenueAreaPath(): string {
    return this.createAreaPath(this.dashboardData?.revenue?.data ?? [], 18000);
  }

  getChartLabels(type: ChartType): string[] {
    if (
      type === 'logins' &&
      !this.dashboardData?.logins?.data?.length &&
      this.dashboardData?.newSignups?.data?.length
    ) {
      return this.dashboardData.newSignups.data.map((point) => point.label);
    }

    return this.dashboardData?.[type]?.data?.map((point) => point.label) ?? [];
  }

  getChartX(index: number, type: ChartType): number {
    const length = this.getChartLabels(type).length;
    return length <= 1 ? 55 : 55 + (index / (length - 1)) * 535;
  }

  private createSmoothPath(data: ChartPoint[], maxValue: number): string {
    if (!data.length || maxValue <= 0) {
      return '';
    }

    const width = 535;
    const height = 285;
    const startX = 55;
    const startY = 15;

    const points = data.map((point, index) => {
      const x = data.length === 1 ? startX : startX + (index / (data.length - 1)) * width;

      const value = Math.max(0, Math.min(Number.isFinite(point.value) ? point.value : 0, maxValue));
      const y = startY + height - (value / maxValue) * height;

      return { x, y };
    });

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    return points.slice(1).reduce((path, point, index) => {
      const previous = points[index];
      const beforePrevious = points[Math.max(0, index - 1)];
      const afterPoint = points[Math.min(points.length - 1, index + 2)];
      const control1X = Math.max(
        startX,
        Math.min(previous.x + (point.x - beforePrevious.x) / 6, startX + width),
      );
      const control1Y = Math.max(
        startY,
        Math.min(previous.y + (point.y - beforePrevious.y) / 6, startY + height),
      );
      const control2X = Math.max(
        startX,
        Math.min(point.x - (afterPoint.x - previous.x) / 6, startX + width),
      );
      const control2Y = Math.max(
        startY,
        Math.min(point.y - (afterPoint.y - previous.y) / 6, startY + height),
      );

      return `${path} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${point.x} ${point.y}`;
    }, `M ${points[0].x} ${points[0].y}`);
  }

  private createAreaPath(data: ChartPoint[], maxValue: number): string {
    const linePath = this.createSmoothPath(data, maxValue);
    if (!linePath) {
      return '';
    }

    const startX = 55;
    const endX = 590;
    const baselineY = 300;

    if (data.length === 1) {
      return `${linePath} L ${startX} ${baselineY} Z`;
    }

    return `${linePath} L ${endX} ${baselineY} L ${startX} ${baselineY} Z`;
  }

  getLoginY(value: number): number {
    return 15 + 285 - (value / 3000) * 285;
  }

  getRevenueY(value: number): number {
    return 15 + 285 - (value / 18000) * 285;
  }

  get hasUserDistribution(): boolean {
    return this.totalUsers > 0;
  }

  private get totalUsers(): number {
    const data = this.dashboardData;

    if (
      data?.admins === undefined ||
      data.instructors === undefined ||
      data.learners === undefined
    ) {
      return 0;
    }

    return data.admins + data.instructors + data.learners;
  }

  getRolePercentage(role: RoleType): string {
    if (!this.dashboardData || this.totalUsers === 0) {
      return '';
    }

    const value = this.dashboardData[role];
    if (value === undefined) {
      return '';
    }

    return `${Math.round((value / this.totalUsers) * 100)}%`;
  }

  private get circumference(): number {
    return 2 * Math.PI * 105;
  }

  get adminSegmentLength(): number {
    return (this.roleValues[0] / (this.totalUsers || 1)) * this.circumference;
  }

  get instructorSegmentLength(): number {
    return (this.roleValues[1] / (this.totalUsers || 1)) * this.circumference;
  }

  get learnerSegmentLength(): number {
    return (this.roleValues[2] / (this.totalUsers || 1)) * this.circumference;
  }

  private get roleValues(): number[] {
    if (
      this.dashboardData?.admins === undefined ||
      this.dashboardData.instructors === undefined ||
      this.dashboardData.learners === undefined ||
      this.totalUsers === 0
    ) {
      return [0, 0, 0];
    }

    return [this.dashboardData.admins, this.dashboardData.instructors, this.dashboardData.learners];
  }

  get adminOffset(): number {
    if (this.totalUsers === 0) {
      return 0;
    }

    return -(this.roleValues[0] / this.totalUsers) * this.circumference;
  }

  get learnerOffset(): number {
    if (this.totalUsers === 0) {
      return 0;
    }

    return -((this.roleValues[0] + this.roleValues[1]) / this.totalUsers) * this.circumference;
  }
}
