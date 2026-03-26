export function buildStudentEmail(rollNo: string): string {
  const safeRoll = String(rollNo ?? '').trim().toUpperCase().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${safeRoll}@student.apas.local`;
}

export function buildStudentPassword(fullName: string, rollNo: string): string {
  const first = String(fullName ?? '').trim().split(/\s+/).find(Boolean) ?? 'student';
  const firstName = first.replace(/[^a-zA-Z]/g, '').toLowerCase() || 'student';
  const digits = String(rollNo ?? '').replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : String(rollNo).slice(-4).toLowerCase();
  return `${firstName}@${last4}`;
}
