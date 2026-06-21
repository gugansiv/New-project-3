import { verifyToken } from './token';
import { NextResponse } from 'next/server';

/**
 * Valid Roles in the system
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  REGIONAL_MANAGER: 'REGIONAL_MANAGER',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  CUSTOMER: 'CUSTOMER'
};

/**
 * Higher Order Function to enforce RBAC on API routes.
 * @param {Array<string>} allowedRoles Array of role strings that are allowed to access.
 * @param {Function} handler The actual Next.js route handler function.
 */
export function withRBAC(allowedRoles, handler) {
  return async (req, ...args) => {
    try {
      const authHeader = req.headers.get('authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Authentication required. No token provided.' }, { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
      }

      // Check if user's role is in the allowedRoles array
      if (!allowedRoles.includes(decoded.role)) {
        return NextResponse.json({ 
          error: 'Forbidden. You do not have permission to perform this action.',
          required: allowedRoles,
          current: decoded.role 
        }, { status: 403 });
      }

      // Attach user info to the request manually via headers (or pass it as context)
      // Since req is a standard Request object in App Router, we clone and append headers
      const newReq = new Request(req, {
        headers: new Headers(req.headers)
      });
      newReq.headers.set('x-user-id', decoded.id);
      newReq.headers.set('x-user-role', decoded.role);
      newReq.headers.set('x-user-store', decoded.storeId || '');

      return await handler(newReq, ...args);
    } catch (err) {
      console.error('RBAC Error:', err);
      return NextResponse.json({ error: 'Internal Server Error during authorization' }, { status: 500 });
    }
  };
}
