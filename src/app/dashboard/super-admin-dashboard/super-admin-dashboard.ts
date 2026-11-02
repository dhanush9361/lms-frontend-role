import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

import { AuthService } from '../../services/auth';

/** One item of the header breadcrumb. `link: null` = not clickable (current page or plain parent). */
interface Breadcrumb {
  label: string;
  link: string[] | null;
}

@Component({
  selector: 'app-super-admin-dashboard',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './super-admin-dashboard.html',
  styleUrl: './super-admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperAdminDashboard {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ---------- header: identity ----------
  readonly displayName = this.auth.displayName;
  readonly roleLabel = computed(() => this.auth.user()?.role ?? '');

  readonly headerName = computed(() => this.auth.user()?.firstName?.trim() || this.displayName());

  readonly initials = computed(() => {
    const parts = this.displayName().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  });

  // ---------- header: breadcrumb ----------
  /** Current URL, kept in sync on every completed navigation. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Breadcrumb shown in the header, right after the logo.
   * Only pages that need one return items; every other page returns [] (nothing rendered).
   * To add another page later, add one more `if` here.
   */
  readonly breadcrumbs = computed<Breadcrumb[]>(() => {
    const path = this.currentUrl().split('#')[0].split('?')[0];
    const packageList = ['/super-admin-dashboard', 'package'];

    // /super-admin-dashboard/package
    if (/^\/super-admin-dashboard\/package\/?$/.test(path)) {
      return [
        { label: 'Content Management', link: null },
        { label: 'Package List', link: null },
      ];
    }

    // /super-admin-dashboard/package/create/permissions
    if (/^\/super-admin-dashboard\/package\/create\/permissions\/?$/.test(path)) {
      return [
        { label: 'Content Management', link: null },
        { label: 'Package List', link: packageList },
        { label: 'Configure Permissions', link: null },
      ];
    }

    // /super-admin-dashboard/package/:id/admins
    if (/^\/super-admin-dashboard\/package\/[^/]+\/admins\/?$/.test(path)) {
      return [
        { label: 'Content Management', link: null },
        { label: 'Package List', link: packageList },
        { label: 'Assign Admin', link: null },
      ];
    }

    return [];
  });

  // ---------- header: account dropdown ----------
  readonly accountMenuOpen = signal(false);

  @HostListener('document:click')
  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/auth']);
  }

  // ---------- header: notification badge ----------
  readonly unreadNotifications = signal(0);

  // ---------- header: action stubs ----------
  openNotifications(): void {
    // TODO: open the notifications panel once the backend endpoint is available.
  }

  openMessages(): void {
    // TODO: open the messages panel once that feature ships.
  }

  openSettings(): void {
    // TODO: navigate to account/organization settings once that route exists.
  }

  onGlobalSearch(term: string): void {
    void term;
  }
}