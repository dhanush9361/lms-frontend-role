import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { catchError, finalize, map, of, throwError } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TokenStorageService } from '../../services/token-storage.service';
import { ProfileData, ProfileService, ProfileUpdate } from '../../services/profile.service';

/* -------------------------------------------------------------------------- */
/*  Constants (same rules as signup - keep in sync with ProfileDto.java)      */
/* -------------------------------------------------------------------------- */

const LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 100,
  organization: 500,
  phoneInput: 14,
} as const;

const NAME_PATTERN = /^[A-Za-z]+$/;
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ALLOWED_PICTURE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Roles that own an organization (see ProfileService.canEditOrganization on the backend). */
const ORGANIZATION_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR']);

const PHONE_LENGTHS_BY_COUNTRY_CODE: Readonly<Record<string, readonly [number, number]>> = {
  '+1': [10, 10],
  '+91': [10, 10],
  '+44': [10, 10],
  '+61': [9, 9],
  '+971': [9, 9],
  '+65': [8, 8],
  '+49': [10, 11],
  '+33': [9, 9],
  '+81': [10, 10],
  '+86': [11, 11],
};

const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

/** Existing countries and dial codes; state/city options are loaded from the location data API. */
const COUNTRIES: Readonly<Record<string, { code: string; states: string[] }>> = {
  India: { code: '+91', states: INDIA_STATES },
  'United States': { code: '+1', states: [] },
  'United Kingdom': { code: '+44', states: ['England', 'Scotland', 'Wales', 'Northern Ireland'] },
  Australia: { code: '+61', states: [] },
  'United Arab Emirates': { code: '+971', states: [] },
  Singapore: { code: '+65', states: [] },
  Germany: { code: '+49', states: [] },
  France: { code: '+33', states: [] },
  Japan: { code: '+81', states: [] },
  China: { code: '+86', states: [] },
};

const LOCATION_API = 'https://countriesnow.space/api/v0.1/countries';

const POSTAL_CODE_RULES: Readonly<
  Record<string, { countryCode: string; minLength: number; maxLength: number }>
> = {
  India: { countryCode: 'IN', minLength: 6, maxLength: 6 },
  'United States': { countryCode: 'US', minLength: 5, maxLength: 9 },
  Australia: { countryCode: 'AU', minLength: 4, maxLength: 4 },
  Singapore: { countryCode: 'SG', minLength: 6, maxLength: 6 },
  Germany: { countryCode: 'DE', minLength: 5, maxLength: 5 },
  France: { countryCode: 'FR', minLength: 5, maxLength: 5 },
  Japan: { countryCode: 'JP', minLength: 7, maxLength: 7 },
  China: { countryCode: 'CN', minLength: 6, maxLength: 6 },
};

const postalCodeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const country = String(control.parent?.get('country')?.value ?? '');
  if (country === 'United Kingdom') return { postalUnsupported: 'United Kingdom' };
  if (country === 'United Arab Emirates') return { postalUnsupported: 'United Arab Emirates' };
  if (!country) return null;

  const rule = POSTAL_CODE_RULES[country];
  if (!rule) return { postalUnsupported: country };

  const value = String(control.value ?? '');
  if (!value) return null;
  if (!/^[0-9]+$/.test(value)) return { postalFormat: true };
  if (value.length < rule.minLength || value.length > rule.maxLength) {
    return { postalLength: true };
  }
  return null;
};

type ProfileField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'organizationName'
  | 'timeZone'
  | 'organizationAddress'
  | 'personalAddress'
  | 'country'
  | 'state'
  | 'city'
  | 'postalCode'
  | 'countryCode'
  | 'phoneNumber';

/** The four fields that use the custom (course-modal style) dropdown. */
type DropdownName = 'timeZone' | 'country' | 'state' | 'countryCode';

const FIELD_LABELS: Readonly<Record<ProfileField, string>> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email ID',
  organizationName: 'Organization Name',
  timeZone: 'Time Zone',
  organizationAddress: 'Organization Address',
  personalAddress: 'Personal Address',
  country: 'Country',
  state: 'State',
  city: 'City',
  postalCode: 'Postal Code',
  countryCode: 'Country Code',
  phoneNumber: 'Phone Number',
};

const MAX_LENGTHS: Readonly<Partial<Record<ProfileField, number>>> = {
  firstName: LIMITS.firstName,
  lastName: LIMITS.lastName,
  email: LIMITS.email,
  organizationName: LIMITS.organization,
  organizationAddress: 500,
  personalAddress: 500,
  country: 100,
  state: 100,
  city: 100,
  postalCode: 20,
};

/** local@domain.tld - domain needs a dot and the TLD needs 2+ letters (rejects "name@gmail.c" and "a@b"). */
const EMAIL_PATTERN =
  /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Replacement for Validators.email; same `{ email: true }` error key. */
const strictEmailValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null; // empty is handled by Validators.required
  return EMAIL_PATTERN.test(value) ? null : { email: true };
};

/** Identical to the signup phone validator: digits only + length range for the selected country code. */
const phoneNumberValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) return null;
  if (!/^[0-9]+$/.test(value)) return { phoneFormat: true };

  const countryCode = String(control.parent?.get('countryCode')?.value ?? '');
  const range = PHONE_LENGTHS_BY_COUNTRY_CODE[countryCode];
  if (!range || value.length < range[0] || value.length > range[1]) {
    return { phoneLength: true };
  }
  return null;
};

const isNetworkOrServerError = (error: HttpErrorResponse): boolean =>
  error.status === 0 || error.status >= 500;

const safeServerMessage = (error: HttpErrorResponse, fallback: string): string => {
  const message: unknown = error?.error?.message;
  return typeof message === 'string' && message.trim() && message.length <= 200
    ? message.trim()
    : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeLocation = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const parseStates = (response: unknown, country: string): string[] => {
  if (!isRecord(response) || response['error'] === true) {
    throw new Error('Invalid country/state response.');
  }

  const data = response['data'];
  const candidates = Array.isArray(data) ? data : [data];
  const countryData = candidates.find(
    (item) => isRecord(item) && normalizeLocation(String(item['name'] ?? '')) === normalizeLocation(country),
  );
  if (!isRecord(countryData) || !Array.isArray(countryData['states'])) {
    throw new Error('Country states were not returned.');
  }

  const states = countryData['states']
    .map((state: unknown) => (isRecord(state) ? state['name'] : null))
    .filter((name: unknown): name is string => typeof name === 'string' && !!name.trim())
    .map((name: string) => name.trim());
  if (!states.length) throw new Error('No states were returned for this country.');
  return [...new Set(states)];
};

const parseCities = (response: unknown): string[] => {
  if (!isRecord(response) || response['error'] === true || !Array.isArray(response['data'])) {
    throw new Error('Invalid state/city response.');
  }

  const cities = response['data'].filter(
    (city: unknown): city is string => typeof city === 'string' && !!city.trim(),
  ).map((city: string) => city.trim());
  if (!cities.length) throw new Error('No cities were returned for this state.');
  return [...new Set(cities)];
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-edit-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly profileService = inject(ProfileService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /* ---- Template-facing constants ---- */
protected readonly limits = LIMITS;
protected readonly countryOptions = Object.keys(COUNTRIES);
protected readonly countrySearch = signal('');

protected get filteredCountryOptions(): string[] {
  const search = this.countrySearch().trim().toLowerCase();

  return this.countryOptions.filter((country) =>
    country.toLowerCase().includes(search)
  );
}

protected readonly timeZones: string[] = [
  'India',
  ...(typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone').filter(
        (zone) => zone !== 'Asia/Kolkata'
      )
    : ['UTC']),
];

protected get filteredTimeZones(): string[] {
  const search = this.timeZoneSearch().trim().toLowerCase();

  return this.timeZones.filter((zone) =>
    zone.replaceAll('_', ' ').toLowerCase().includes(search)
  );
}
  protected readonly countryCodeOptions = signal(Object.keys(PHONE_LENGTHS_BY_COUNTRY_CODE));

  /* ---- UI state ---- */
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly saveSuccess = signal('');
  protected readonly pictureError = signal('');
  protected readonly stateOptions = signal<string[]>([]);
  protected readonly cityOptions = signal<string[]>([]);
  protected readonly stateDataError = signal('');
  protected readonly cityDataError = signal('');
  protected readonly postalVerificationError = signal('');
  protected readonly profilePicturePreview = signal<string | null>(null);
  protected readonly backgroundPicturePreview = signal<string | null>(null);
  protected readonly initials = signal('?');
  /** Which custom dropdown (time zone / country / state / country code) is currently open. */
  protected readonly timeZoneSearch = signal('');
  protected readonly openDropdown = signal<DropdownName | null>(null);

  /** Field -> message from the server (400 validation map / 409 email). Cleared when the field is edited. */
  private readonly serverErrors = signal<Partial<Record<ProfileField, string>>>({});

  /** Admin, super admin and instructor can view/update their organization name + address. */
  protected readonly showsOrganizationFields = computed(() =>
    ORGANIZATION_ROLES.has((this.auth.user()?.role ?? '').toUpperCase()),
  );

  /** Logged-in user's real role as display text, e.g. SUPER_ADMIN -> "Super Admin". */
  protected readonly roleLabel = computed(() =>
    (this.auth.user()?.role ?? '')
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' '),
  );

  protected readonly form = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(LIMITS.firstName),
        Validators.pattern(NAME_PATTERN),
      ],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(LIMITS.lastName),
        Validators.pattern(NAME_PATTERN),
      ],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, strictEmailValidator, Validators.maxLength(LIMITS.email)],
    }),
    // Text, numbers and special characters allowed - only the length is limited.
    organizationName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITS.organization)],
    }),
    timeZone: new FormControl('', { nonNullable: true }),
    organizationAddress: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    personalAddress: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    country: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    state: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    postalCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(9), postalCodeValidator],
    }),
    countryCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phoneNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, phoneNumberValidator],
    }),
  });

  private lastLoaded: ProfileData | null = null;
  private stateRequestId = 0;
  private cityRequestId = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.messageTimer) clearTimeout(this.messageTimer);
    });

    // Phone length rules depend on the country code.
    this.form.controls.countryCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.phoneNumber.updateValueAndValidity());

    this.form.controls.country.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.onCountryChanged());

    this.form.controls.state.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.onStateChanged());

    this.form.controls.city.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.clearLocationServerErrors();
        this.postalVerificationError.set('');
        this.form.controls.postalCode.updateValueAndValidity({ emitEvent: false });
      });

    this.form.controls.postalCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.postalVerificationError.set(''));

    // Keep the avatar initials in sync with the name inputs.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.updateInitials());

    // Editing a field clears its stale server error.
    (Object.keys(this.form.controls) as ProfileField[]).forEach((field) => {
      this.form.controls[field].valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        if (this.serverErrors()[field]) {
          this.serverErrors.update(({ [field]: _removed, ...rest }) => rest);
        }
      });
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  /* ------------------------------------------------------------------------ */
  /*  Custom dropdowns (same behaviour as the Create Course modal)            */
  /* ------------------------------------------------------------------------ */

  /** Clicks inside a dropdown stop propagation in the template, so any click that reaches here is "outside". */
  @HostListener('document:click')
  protected closeDropdowns(): void {
    if (this.openDropdown()) this.openDropdown.set(null);
  }

  @HostListener('document:keydown.escape')
  protected closeDropdownsOnEscape(): void {
    if (this.openDropdown()) this.openDropdown.set(null);
  }

  protected toggleDropdown(name: DropdownName): void {
    this.openDropdown.update((current) => (current === name ? null : name));
  }

  protected chooseOption(name: DropdownName, value: string): void {
    const control = this.form.controls[name];
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
    this.openDropdown.set(null);

  }

  /* ------------------------------------------------------------------------ */
  /*  Load                                                                    */
  /* ------------------------------------------------------------------------ */

  private loadProfile(): void {
    this.loading.set(true);
    this.profileService
      .getMyProfile()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => this.applyProfile(profile),
        error: (error: HttpErrorResponse) =>
          this.saveError.set(
            isNetworkOrServerError(error)
              ? 'Unable to load your profile. Please try again later.'
              : safeServerMessage(error, 'Unable to load your profile.'),
          ),
      });
  }

  private applyProfile(profile: ProfileData): void {
    this.lastLoaded = profile;

    this.form.reset(
      {
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        email: profile.email ?? '',
        organizationName: profile.organizationName ?? '',
        timeZone: profile.timeZone ?? '',
        organizationAddress: profile.organizationAddress ?? '',
        personalAddress: profile.personalAddress ?? '',
        country: profile.country ?? '',
        state: profile.state ?? '',
        city: profile.city ?? '',
        postalCode: profile.postalCode ?? '',
        countryCode: profile.countryCode ?? '',
        phoneNumber: profile.phoneNumber ?? '',
      },
      { emitEvent: false },
    );
    this.form.updateValueAndValidity();

    this.stateOptions.set([]);
    this.cityOptions.set([]);
    this.stateDataError.set('');
    this.cityDataError.set('');
    this.postalVerificationError.set('');
    this.clearLocationServerErrors();
    if (profile.country) this.loadStates(profile.country, profile.state ?? '');
    this.profilePicturePreview.set(profile.profilePictureUrl);
    this.backgroundPicturePreview.set(profile.backgroundPictureUrl);
    this.updateInitials();
  }

  private updateInitials(): void {
    const { firstName, lastName } = this.form.getRawValue();
    this.initials.set(((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '?');
  }

  private clearLocationServerErrors(): void {
    this.serverErrors.update(
      ({ country: _country, state: _state, city: _city, postalCode: _postalCode, ...rest }) => rest,
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  Template helpers                                                        */
  /* ------------------------------------------------------------------------ */

  protected onCountryChanged(): void {
    const country = this.form.controls.country.value;
    this.cityRequestId++;
    this.stateOptions.set([]);
    this.cityOptions.set([]);
    this.stateDataError.set('');
    this.cityDataError.set('');
    this.postalVerificationError.set('');
    this.clearLocationServerErrors();
    this.form.controls.state.setValue('', { emitEvent: false });
    this.form.controls.city.setValue('', { emitEvent: false });
    this.form.controls.postalCode.setValue('', { emitEvent: false });
    this.form.controls.postalCode.updateValueAndValidity({ emitEvent: false });
    this.loadStates(country);

    // Only suggest a dial code when none is chosen yet; never overwrite the user's own code.
    const dialCode = COUNTRIES[country]?.code;
    if (dialCode && !this.form.controls.countryCode.value) {
      this.form.controls.countryCode.setValue(dialCode);
    }
  }

  protected onPostalCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/[^0-9]/g, '');
    if (input.value !== digits) {
      input.value = digits;
      this.form.controls.postalCode.setValue(digits);
    }
  }

  private onStateChanged(): void {
    const country = this.form.controls.country.value;
    const state = this.form.controls.state.value;
    this.cityRequestId++;
    this.cityOptions.set([]);
    this.cityDataError.set('');
    this.postalVerificationError.set('');
    this.clearLocationServerErrors();
    this.form.controls.city.setValue('', { emitEvent: false });
    this.form.controls.postalCode.setValue('', { emitEvent: false });
    this.form.controls.postalCode.updateValueAndValidity({ emitEvent: false });

    if (!country || !state || !this.stateOptions().includes(state)) return;
    this.loadCities(country, state);
  }

  private loadStates(country: string, selectedState = ''): void {
    const requestId = ++this.stateRequestId;
    if (!country) return;
    this.http
      .get<unknown>(`${LOCATION_API}/states/q`, { params: { country } })
      .pipe(
        map((response) => parseStates(response, country)),
        catchError((_error: unknown) => {
          if (requestId !== this.stateRequestId || this.form.controls.country.value !== country) {
            return of([]);
          }
          if (country === 'India') {
            this.stateDataError.set('');
            return of(INDIA_STATES);
          }
          this.stateDataError.set('Unable to load states for this country. Please try again.');
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((states) => {
        if (requestId !== this.stateRequestId || this.form.controls.country.value !== country) return;
        this.stateOptions.set(states);
        const currentState = selectedState || this.form.controls.state.value;
        if (currentState && states.includes(currentState)) {
          this.loadCities(country, currentState);
        } else if (currentState) {
          this.cityDataError.set('Select a state that belongs to the selected country.');
        }
      });
  }

  private loadCities(country: string, state: string): void {
    const requestId = ++this.cityRequestId;
    this.http
      .get<unknown>(`${LOCATION_API}/state/cities/q`, { params: { country, state } })
      .pipe(
        map(parseCities),
        catchError((_error: unknown) => {
          if (
            requestId !== this.cityRequestId ||
            this.form.controls.country.value !== country ||
            this.form.controls.state.value !== state
          ) return of([]);
          this.cityDataError.set('Unable to load cities for this state. Please try again.');
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cities) => {
        if (
          requestId !== this.cityRequestId ||
          this.form.controls.country.value !== country ||
          this.form.controls.state.value !== state
        ) return;
        this.cityOptions.set(cities);
      });
  }

  protected fieldError(field: ProfileField): string {
    const serverMessage = this.serverErrors()[field];
    if (serverMessage) return serverMessage;

    const control = this.form.controls[field];
    const errors = control.errors;
    if (!control.touched) return '';

    const label = FIELD_LABELS[field];
    if (field !== 'postalCode' && errors?.['required']) return `${label} is required.`;
    if (field === 'state') {
      if (this.stateDataError()) return this.stateDataError();
      if (!this.stateOptions().includes(control.value)) {
        return 'Select a state belonging to the selected country.';
      }
    }
    if (field === 'city') {
      if (this.cityDataError()) return this.cityDataError();
      if (!this.cityOptions().some(
        (city) => normalizeLocation(city) === normalizeLocation(control.value),
      )) {
        return 'Enter a city belonging to the selected state.';
      }
    }
    if (field === 'postalCode' && this.postalVerificationError()) {
      return this.postalVerificationError();
    }
    if (!errors) return '';

    if (field === 'postalCode' && errors['postalUnsupported']) {
      if (errors['postalUnsupported'] === 'United Kingdom') {
        return 'United Kingdom postal codes contain letters and are not supported by the digits-only rule.';
      }
      if (errors['postalUnsupported'] === 'United Arab Emirates') {
        return 'Postal-code verification is not available for the selected country.';
      }
      return 'Postal-code verification is not available for the selected country.';
    }
    if (errors['required']) return `${label} is required.`;
    if (errors['maxlength']) return `${label} must not exceed ${MAX_LENGTHS[field] ?? 500} characters.`;

    switch (field) {
      case 'country':
        return 'Select a valid country.';
      case 'postalCode':
        if (this.postalVerificationError()) return this.postalVerificationError();
        if (errors['postalFormat']) return 'Postal Code must contain digits only.';
        if (errors['postalLength']) {
          const rule = POSTAL_CODE_RULES[this.form.controls.country.value];
          return rule?.minLength === rule?.maxLength
            ? `Enter a ${rule.minLength}-digit postal code.`
            : `Enter a postal code with ${rule.minLength} to ${rule.maxLength} digits.`;
        }
        return '';
      case 'firstName':
      case 'lastName':
        if (errors['minlength']) return `${label} must be between 2 and ${MAX_LENGTHS[field]} characters.`;
        if (errors['pattern']) return `${label} must contain only letters.`;
        return '';
      case 'email':
        return 'Enter a valid email address (e.g. name@example.com).';
      case 'phoneNumber':
        if (errors['phoneFormat']) return 'Enter a valid phone number.';
        if (errors['phoneLength']) {
          return 'Enter a phone number with a valid length for the selected country code.';
        }
        return '';
      default:
        return '';
    }
  }

  /* ------------------------------------------------------------------------ */
  /*  Save                                                                    */
  /* ------------------------------------------------------------------------ */

  protected saveProfile(): void {
    this.saveError.set('');
    this.saveSuccess.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const v = this.form.getRawValue();
    const locationError = this.locationValidationError(v.country, v.state, v.city);
    if (locationError) {
      this.saveError.set(locationError);
      return;
    }

    const payload: ProfileUpdate = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim().toLowerCase(),
      organizationName: v.organizationName.trim(),
      organizationAddress: v.organizationAddress.trim(),
      personalAddress: v.personalAddress.trim(),
      timeZone: v.timeZone === 'India' ? 'Asia/Kolkata' : v.timeZone,
      country: v.country,
      state: v.state.trim(),
      city: v.city.trim(),
      postalCode: v.postalCode.trim(),
      countryCode: v.countryCode,
      phoneNumber: v.phoneNumber.trim(),
    };

    this.saving.set(true);
    this.verifyPostalLocation(v.country, v.state, v.city, v.postalCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (valid) => {
          if (!valid) {
            this.postalVerificationError.set(
              'Postal Code does not match the selected Country, State, and City.',
            );
            this.saving.set(false);
            return;
          }

          this.profileService
            .updateMyProfile(payload)
            .pipe(
              finalize(() => this.saving.set(false)),
              takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
              next: (profile) => {
                this.applyProfile(profile);
                this.syncAuthUser(profile);
                this.saveSuccess.set('Profile updated successfully.');
                this.autoHideMessages();
              },
              error: (error: HttpErrorResponse) => this.onSaveError(error),
            });
        },
        error: () => {
          this.postalVerificationError.set(
            'Unable to verify this postal code right now. Please try again.',
          );
          this.saving.set(false);
        },
      });
  }

  private locationValidationError(country: string, state: string, city: string): string {
    if (!this.countryOptions.includes(country)) return 'Select a valid country.';
    if (this.stateDataError() || !this.stateOptions().includes(state)) {
      return this.stateDataError() || 'Select a state belonging to the selected country.';
    }
    if (this.cityDataError() || !this.cityOptions().some(
      (option) => normalizeLocation(option) === normalizeLocation(city),
    )) {
      return this.cityDataError() || 'Enter a city belonging to the selected state.';
    }
    return '';
  }

  private verifyPostalLocation(
    country: string,
    state: string,
    city: string,
    postalCode: string,
  ) {
    if (country === 'India') {
      return this.http
        .get<unknown>(`https://api.postalpincode.in/pincode/${postalCode}`)
        .pipe(map((response) => this.matchesIndiaPostalLocation(response, state, city, postalCode)));
    }

    const rule = POSTAL_CODE_RULES[country];
    if (!rule) return of(false);

    return this.http
      .get<unknown>(`https://api.zippopotam.us/${rule.countryCode.toLowerCase()}/${postalCode}`)
      .pipe(
        map((response) => this.matchesPostalLocation(response, rule.countryCode, state, city, postalCode)),
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 404
            ? of(false)
            : throwError(() => error),
        ),
      );
  }

  private matchesIndiaPostalLocation(
    response: unknown,
    state: string,
    city: string,
    postalCode: string,
  ): boolean {
    if (!Array.isArray(response) || !isRecord(response[0])) return false;
    const result = response[0];
    if (result['Status'] !== 'Success' || !Array.isArray(result['PostOffice'])) return false;

    return result['PostOffice'].some((office: unknown) => {
      if (!isRecord(office) || office['Country'] !== 'India' || office['Pincode'] !== postalCode) {
        return false;
      }
      const stateMatches = normalizeLocation(String(office['State'] ?? '')) === normalizeLocation(state);
      const cityMatches = ['Name', 'District', 'Block', 'Region'].some(
        (field) => normalizeLocation(String(office[field] ?? '')) === normalizeLocation(city),
      );
      return stateMatches && cityMatches;
    });
  }

  private matchesPostalLocation(
    response: unknown,
    countryCode: string,
    state: string,
    city: string,
    postalCode: string,
  ): boolean {
    if (!isRecord(response) || response['country abbreviation'] !== countryCode) return false;
    if (String(response['post code'] ?? '').replace(/[^0-9]/g, '') !== postalCode) return false;
    if (!Array.isArray(response['places'])) return false;

    return response['places'].some((place: unknown) => {
      if (!isRecord(place)) return false;
      const stateMatches = normalizeLocation(String(place['state'] ?? '')) === normalizeLocation(state)
        || normalizeLocation(String(place['state abbreviation'] ?? '')) === normalizeLocation(state);
      const cityMatches = normalizeLocation(String(place['place name'] ?? '')) === normalizeLocation(city);
      return stateMatches && cityMatches;
    });
  }

  protected cancel(): void {
  this.serverErrors.set({});
  this.saveError.set('');
  this.saveSuccess.set('');
  this.pictureError.set('');
  this.openDropdown.set(null);
  void this.router.navigate(['/admin-dashboard', 'admin-dashboard-home']);
}

  /** The save success / error pop-up (top centre) disappears by itself after a few seconds. */
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  private autoHideMessages(): void {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.saveSuccess.set('');
      this.saveError.set('');
      this.messageTimer = null;
    }, 4000);
  }

  /** Keeps the header / session in sync with the new name + email without a re-login. */
  private syncAuthUser(profile: ProfileData): void {
    const current = this.auth.user();
    if (!current) return;
    const updated = {
      ...current,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
    };
    this.tokenStorage.updateUser(updated);
    this.auth.user.set(updated);
  }

  private onSaveError(error: HttpErrorResponse): void {
    this.autoHideMessages();
    if (isNetworkOrServerError(error)) {
      this.saveError.set('Unable to save your profile. Please try again later.');
      return;
    }

    // 400 from @Valid: { data: { fieldName: message } } - show each message under its field.
    const fieldMap: unknown = error.error?.data;
    if (error.status === 400 && fieldMap && typeof fieldMap === 'object') {
      const mapped: Partial<Record<ProfileField, string>> = {};
      for (const [key, message] of Object.entries(fieldMap as Record<string, unknown>)) {
        if (key in FIELD_LABELS && typeof message === 'string') {
          mapped[key as ProfileField] = message;
        }
      }
      if (Object.keys(mapped).length) {
        this.serverErrors.set(mapped);
        return;
      }
    }

    if (error.status === 409) {
      this.form.controls.email.markAsTouched();
      this.serverErrors.set({ email: 'Email ID already exists.' });
      return;
    }

    this.saveError.set(safeServerMessage(error, 'Unable to save your profile. Please try again.'));
  }

  /* ------------------------------------------------------------------------ */
  /*  Pictures (uploaded immediately when chosen)                             */
  /* ------------------------------------------------------------------------ */

  protected onProfilePictureSelected(event: Event): void {
    this.handlePicture(event, (file) => this.profileService.uploadProfilePicture(file), (p) =>
      this.profilePicturePreview.set(p.profilePictureUrl),
    );
  }

  protected onBackgroundPictureSelected(event: Event): void {
    this.handlePicture(event, (file) => this.profileService.uploadBackgroundPicture(file), (p) =>
      this.backgroundPicturePreview.set(p.backgroundPictureUrl),
    );
  }

  private handlePicture(
    event: Event,
    upload: (file: File) => ReturnType<ProfileService['uploadProfilePicture']>,
    onDone: (profile: ProfileData) => void,
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later
    this.pictureError.set('');
    if (!file) return;

    const fileExtension = file.name
  .substring(file.name.lastIndexOf('.'))
  .toLowerCase();

if (
  !ALLOWED_PICTURE_TYPES.includes(file.type) ||
  !ALLOWED_PICTURE_EXTENSIONS.includes(fileExtension)
) {
  this.pictureError.set('GIF images are not allowed. Only JPG, PNG or WEBP images are allowed.');
  return;
}
    if (file.size > MAX_PICTURE_BYTES) {
      this.pictureError.set('File size exceeds 5 MB.');
      return;
    }

    upload(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.lastLoaded = { ...(this.lastLoaded ?? profile), ...pickPictures(profile) };
          onDone(profile);
        },
        error: (error: HttpErrorResponse) =>
          this.pictureError.set(
            isNetworkOrServerError(error)
              ? 'Unable to upload the image. Please try again later.'
              : safeServerMessage(error, 'Unable to upload the image.'),
          ),
      });
  }
}

function pickPictures(p: ProfileData): Pick<ProfileData, 'profilePictureUrl' | 'backgroundPictureUrl'> {
  return { profilePictureUrl: p.profilePictureUrl, backgroundPictureUrl: p.backgroundPictureUrl };
}