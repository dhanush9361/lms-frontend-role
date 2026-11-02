import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Shape returned by GET/PUT/POST /api/profile/... (picture URLs are already absolute here). */
export interface ProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  organizationName: string | null;
  organizationAddress: string | null;
  personalAddress: string | null;
  timeZone: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string | null;
  phoneNumber: string;
  profilePictureUrl: string | null;
  backgroundPictureUrl: string | null;
}

/** Body of PUT /api/profile/me. */
export interface ProfileUpdate {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  organizationAddress: string;
  personalAddress: string;
  timeZone: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/profile`;

  getMyProfile(): Observable<ProfileData> {
    return this.http.get<ApiResponse<ProfileData>>(`${this.apiUrl}/me`).pipe(this.unwrap());
  }

  updateMyProfile(payload: ProfileUpdate): Observable<ProfileData> {
    return this.http.put<ApiResponse<ProfileData>>(`${this.apiUrl}/me`, payload).pipe(this.unwrap());
  }

  uploadProfilePicture(file: File): Observable<ProfileData> {
    return this.http
      .post<ApiResponse<ProfileData>>(`${this.apiUrl}/me/picture`, this.toFormData(file))
      .pipe(this.unwrap());
  }

  uploadBackgroundPicture(file: File): Observable<ProfileData> {
    return this.http
      .post<ApiResponse<ProfileData>>(`${this.apiUrl}/me/background-picture`, this.toFormData(file))
      .pipe(this.unwrap());
  }

  removeProfilePicture(): Observable<ProfileData> {
    return this.http.delete<ApiResponse<ProfileData>>(`${this.apiUrl}/me/picture`).pipe(this.unwrap());
  }

  removeBackgroundPicture(): Observable<ProfileData> {
    return this.http
      .delete<ApiResponse<ProfileData>>(`${this.apiUrl}/me/background-picture`)
      .pipe(this.unwrap());
  }

  /** Backend stores relative paths (/uploads/profile/x.jpg); make them absolute for <img [src]>. */
  private resolveMediaUrl(path: string | null): string | null {
    if (!path) return null;
    return /^https?:\/\//i.test(path) ? path : `${environment.apiBaseUrl}${path}`;
  }

  private unwrap() {
    return map<ApiResponse<ProfileData>, ProfileData>(({ data }) => ({
      ...data,
      profilePictureUrl: this.resolveMediaUrl(data.profilePictureUrl),
      backgroundPictureUrl: this.resolveMediaUrl(data.backgroundPictureUrl),
    }));
  }

  // Do NOT set Content-Type manually - the browser adds the multipart boundary.
  private toFormData(file: File): FormData {
    const form = new FormData();
    form.append('file', file);
    return form;
  }
}