import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { EnrolledLearnerDto } from '../course-module/enrollment.model';
import { EnrollmentService } from './enrollment.service';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EnrollmentService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(EnrollmentService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('loads every page when the result exceeds 50 pages', async () => {
    const enrollmentsPromise = firstValueFrom(service.getEnrollments(42));
    const pageCount = 51;

    for (let page = 0; page < pageCount; page += 1) {
      const request = httpTestingController.expectOne(
        (request) =>
          request.url === `${environment.apiBaseUrl}/api/courses/42/enrollments` &&
          request.params.get('page') === String(page),
      );

      expect(request.request.method).toBe('GET');
      expect(request.request.params.get('size')).toBe('100');

      request.flush({
        success: true,
        message: '',
        data: {
          content: [makeEnrollment(page + 1)],
          number: page,
          totalPages: pageCount,
          totalElements: pageCount,
        },
      });
    }

    const enrollments = await enrollmentsPromise;

    expect(enrollments).toHaveLength(pageCount);
    expect(enrollments[0].id).toBe(1);
    expect(enrollments[pageCount - 1].id).toBe(pageCount);
  });
});

function makeEnrollment(id: number): EnrolledLearnerDto {
  return {
    enrollmentId: id,
    userId: id,
    userName: `Learner ${id}`,
    enrollmentDate: null,
    completionDate: null,
    expirationDate: null,
    progressPercent: null,
    status: 'In Progress',
    scorePercent: null,
    completion: null,
  };
}
