// The existing KOUB Staff binary and backend, not the paused separate QA track.
import { PRODUCTION_ORIGIN, type AppBoundary } from './auth-boundary';
export const APP_BOUNDARY: AppBoundary = { variant: 'production', origin: PRODUCTION_ORIGIN };
export const KOUB_AUTH_ORIGIN = PRODUCTION_ORIGIN;
