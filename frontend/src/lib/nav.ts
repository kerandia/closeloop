import { isMockMode } from '../api/client'

/** Carry the ?mock=1 flag across navigation so offline demo mode stays consistent. */
export function withMock(path: string): string {
  if (!isMockMode()) return path
  return `${path}${path.includes('?') ? '&' : '?'}mock=1`
}
