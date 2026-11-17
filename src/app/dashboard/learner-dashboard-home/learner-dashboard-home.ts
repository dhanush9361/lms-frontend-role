
import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

interface CourseStatus {
  completed: number;
  inProgress: number;
  notStarted: number;
}

interface QuizScore {
  courseName: string;
  score: number;
  maxScore: number;
}

interface TrainingRecord {
  courseName: string;
  totalMinutes: number;
}

interface LearnerDashboardData {
  passedQuizzes: number | null;
  enrolledCourses: number | null;
  completedCourses: number | null;
  inProgressCourses: number | null;
  notStartedCourses: number | null;
  courseStatus: CourseStatus | null;
  quizCourses: {
    id: number;
    name: string;
  }[];
  quizScores: QuizScore[];
  trainingTime: TrainingRecord[];
}

interface CourseResponse {
  id: number;
  name: string;
  enrolled: boolean;
  enrollmentStatus: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Component({
  selector: 'app-learner-dashboard-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './learner-dashboard-home.html'
})
export class LearnerDashboardHome implements OnInit, AfterViewInit {

  private authService = inject(AuthService);
  private http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiBaseUrl}/api/courses`;

  displayName = this.authService.displayName;

  dashboard = signal<LearnerDashboardData | null>(null);

  loading = signal(false);
  error = signal('');

  isVisible = signal(false);

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      this.isVisible.set(true);
    });
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');

    this.http.get<ApiResponse<CourseResponse[]>>(this.apiUrl)
      .pipe(
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (!response.success || !Array.isArray(response.data)) {
            this.dashboard.set(null);
            this.error.set(response.message || 'Unable to load dashboard data.');
            return;
          }

          const courses = response.data.filter(
            course => course.enrolled !== false
          );

          const completed = courses.filter(
            course => course.enrollmentStatus?.toUpperCase() === 'COMPLETED'
          ).length;

          const inProgress = courses.filter(
            course => course.enrollmentStatus?.toUpperCase() === 'IN_PROGRESS'
          ).length;

          const notStarted = courses.filter(
            course => course.enrollmentStatus?.toUpperCase() === 'NOT_STARTED'
          ).length;

          this.dashboard.set({
            passedQuizzes: null,
            enrolledCourses: courses.length,
            completedCourses: completed,
            inProgressCourses: inProgress,
            notStartedCourses: notStarted,

           courseStatus: {
  completed,
  inProgress,
  notStarted
},

quizCourses: courses.map(course => ({
  id: course.id,
  name: course.name
})),

quizScores: [],
trainingTime: []
          });
        },

        error: (err) => {
          console.error('Learner dashboard API error:', err);

          this.dashboard.set(null);

          this.error.set(
            err.status === 0
              ? 'Network error. Please check your internet connection.'
              : err.status === 401
                ? 'Your session has expired. Please log in again.'
                : 'Unable to load dashboard data. Please try again.'
          );
        }
      });
  }

  get courseStatus(): CourseStatus | null {
    return this.dashboard()?.courseStatus ?? null;
  }

  get totalCourses(): number {
    const status = this.courseStatus;

    if (!status) return 0;

    return status.completed +
      status.inProgress +
      status.notStarted;
  }

  get hasCourseStatus(): boolean {
    return this.totalCourses > 0;
  }

  get hasQuizScores(): boolean {
    return (this.dashboard()?.quizScores.length ?? 0) > 0;
  }

  get hasTrainingTime(): boolean {
    return (this.dashboard()?.trainingTime.length ?? 0) > 0;
  }

  get completedPercentage(): number {
    if (!this.totalCourses || !this.courseStatus) return 0;

    return (this.courseStatus.completed / this.totalCourses) * 100;
  }

  get inProgressPercentage(): number {
    if (!this.totalCourses || !this.courseStatus) return 0;

    return (this.courseStatus.inProgress / this.totalCourses) * 100;
  }

  get notStartedPercentage(): number {
    if (!this.totalCourses || !this.courseStatus) return 0;

    return (this.courseStatus.notStarted / this.totalCourses) * 100;
  }

  get doughnutGradient(): string {
    if (!this.hasCourseStatus || !this.courseStatus) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    const completed = this.completedPercentage * 3.6;
    const inProgress = this.inProgressPercentage * 3.6;

    return `conic-gradient(
      #60bdca 0deg ${completed}deg,
      #a064f5 ${completed}deg ${completed + inProgress}deg,
      #5c73e8 ${completed + inProgress}deg 360deg
    )`;
  }

  getQuizPercentage(score: number, maxScore: number): number {
    if (!maxScore || maxScore <= 0) return 0;

    return Math.min(100, Math.max(0, (score / maxScore) * 100));
  }

  formatTrainingTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m`;
  }

  retry(): void {
    this.loadDashboard();
  }
}
