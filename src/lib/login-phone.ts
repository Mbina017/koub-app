export function bahrainLoginPhone(input: string): string | null {
  const normalized = input.trim().replace(/[٠-٩۰-۹]/g, (c) => String(c.charCodeAt(0) - (c >= '۰' ? 0x6f0 : 0x660)));
  if (!/^[+0-9\s().-]+$/.test(normalized)) return null;
  const compact = normalized.replace(/[\s().-]/g, '');
  const m = /^(?:(?:\+|00)?973)?([0-9]{8})$/.exec(compact);
  return m ? '973' + m[1] : null;
}

export function canRestoreKoubSession(role: unknown) {
  return role === 'owner' || role === 'cashier';
}
