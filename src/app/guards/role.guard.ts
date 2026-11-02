import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth';

/** Where each role lands when it opens a page it is not allowed to see. */
const HOME_ROUTE_BY_ROLE: Readonly<Record<string, string>> = {
  SUPER_ADMIN: '/super-admin-dashboard',
  ADMIN: '/admin-dashboard',
};

/**
 * Usage: `canActivate: [roleGuard('SUPER_ADMIN')]`
 *
 * - Not logged in            -> /auth
 * - Logged in, wrong role    -> that role's own dashboard (no "access denied" flash)
 * - Logged in, allowed role  -> route opens
 *
 * NOTE: this only protects the UI. The backend must still enforce the role on every
 * super-admin API (e.g. Spring `@PreAuthorize("hasRole('SUPER_ADMIN')")`).
 */
export const roleGuard =
  (...allowedRoles: string[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const role = auth.user()?.role;
    if (!role) return router.createUrlTree(['/auth']);
    if (allowedRoles.includes(role)) return true;

    return router.createUrlTree([HOME_ROUTE_BY_ROLE[role] ?? '/auth']);
  };