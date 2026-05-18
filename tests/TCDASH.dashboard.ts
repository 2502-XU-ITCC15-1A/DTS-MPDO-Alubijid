// __tests__/dashboard.utils.test.ts
// Tests for pure functions extracted from client/pages/Dashboard.tsx
// Run via: npm test (Vitest, root package.json)
import { describe, it, expect, vi, beforeEach } from 'vitest';

const statusColors = {
  Pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  Processing: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  'Needs revision': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  Approved: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Released: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Overdue: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Sent for approval': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
} as const;

const statusOptions = [
  { value: 'Pending', label: 'Pending', text: 'text-yellow-700' },
  { value: 'Processing', label: 'Processing', text: 'text-slate-700' },
  { value: 'Needs revision', label: 'Needs revision', text: 'text-orange-700' },
  { value: 'Approved', label: 'Approved', text: 'text-green-700' },
  { value: 'Completed', label: 'Completed', text: 'text-green-700' },
  { value: 'Sent for approval', label: 'Sent for approval', text: 'text-purple-600' },
  { value: 'Overdue', label: 'Overdue', text: 'text-red-700' },
] as const;

const getStatusColor = (status: string) =>
  statusColors[status as keyof typeof statusColors] ?? statusColors.Pending;

const getStatusValue = (status: string) =>
  status === 'Released' ? 'Approved' : status;

const getStatusDetails = (status: string) => {
  const resolvedStatus = status === 'Released' ? 'Approved' : status;
  return statusOptions.find((option) => option.value === resolvedStatus) ?? statusOptions[0];
};

const formatStatusChangeTitle = (oldStatus: string, newStatus: string) =>
  oldStatus
    ? `Status changed from ${oldStatus} to ${newStatus}`
    : `Status changed to ${newStatus}`;

const getDocumentIdFromQrText = (text: string) => {
  try {
    const url = new URL(text);
    const docId = url.searchParams.get('doc');
    if (docId) return docId;
  } catch {
    // ignore invalid URL
  }
  const dtnMatch = text.match(/DTN:([^|]+)/);
  if (dtnMatch) return dtnMatch[1].trim();
  const plainDtnMatch = text.match(/DTN-\d{4}-\d+/i);
  return plainDtnMatch?.[0] ?? null;
};

const parseStoredList = (key: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
};

// The pure functions under test — copy-pasted or imported from Dashboard.tsx:
// getStatusColor, getStatusValue, getStatusDetails (Rica)
// formatStatusChangeTitle, getDocumentIdFromQrText (Joshua)
// parseStoredList, stats derivation (Joshua)
// getVisibleDocuments logic, filteredDocuments logic (Ethan)

// Paste or import getStatusColor and statusColors from Dashboard.tsx
describe('getStatusColor', () => {
it('TC-DASH-01a: Pending → yellow palette', () => {
const r = getStatusColor('Pending');
expect(r.bg).toBe('bg-yellow-50');
expect(r.text).toBe('text-yellow-700');
expect(r.border).toBe('border-yellow-200');
});
it('TC-DASH-01b: Overdue → red palette', () => {
const r = getStatusColor('Overdue');
expect(r.bg).toBe('bg-red-50');
expect(r.text).toBe('text-red-700');
});
it('TC-DASH-01c: Completed → green palette', () => {
expect(getStatusColor('Completed').bg).toBe('bg-green-50');
});
it('TC-DASH-01d: Sent for approval → purple palette', () => {
expect(getStatusColor('Sent for approval').text).toBe('text-purple-600');
});
it('TC-DASH-01e: unknown status falls back to Pending palette', () => {
const r = getStatusColor('UnknownStatus');
expect(r.bg).toBe('bg-yellow-50');
expect(r.text).toBe('text-yellow-700');
});
});
describe('getStatusValue', () => {
it('TC-DASH-02a: Released maps to Approved', () => {
expect(getStatusValue('Released')).toBe('Approved');
});
it('TC-DASH-02b: all other statuses pass through unchanged', () => {
const unchanged = ['Pending','Processing','Overdue','Completed','Sent for approval'];
unchanged.forEach(s => expect(getStatusValue(s)).toBe(s));
});
});
describe('getStatusDetails', () => {
it('TC-DASH-03a: Sent for approval returns purple text option', () => {
const r = getStatusDetails('Sent for approval');
expect(r.value).toBe('Sent for approval');
expect(r.text).toBe('text-purple-600');
});
it('TC-DASH-03b: Released resolves to Approved option', () => {
expect(getStatusDetails('Released').value).toBe('Approved');
});
it('TC-DASH-03c: unknown status falls back to Pending (statusOptions[0])', () => {
expect(getStatusDetails('GhostStatus').value).toBe('Pending');
});
});
// formatStatusChangeTitle is defined at the bottom of Dashboard.tsx (line ~3880)
describe('formatStatusChangeTitle', () => {
it('TC-DASH-04a: produces from→to string when oldStatus given', () => {
expect(formatStatusChangeTitle('Pending', 'Processing'))
.toBe('Status changed from Pending to Processing');
});
it('TC-DASH-04b: produces to-only string when oldStatus is empty', () => {
expect(formatStatusChangeTitle('', 'Processing'))
.toBe('Status changed to Processing');
});
it('TC-DASH-04c: works for approval transition', () => {
expect(formatStatusChangeTitle('Sent for approval', 'Completed'))
.toBe('Status changed from Sent for approval to Completed');
});
});
describe('getDocumentIdFromQrText', () => {
it('TC-DASH-05a: extracts DTN from ?doc= URL param', () => {
expect(getDocumentIdFromQrText(
'https://app.example.com/dashboard?doc=DTN-2026-0001'
)).toBe('DTN-2026-0001');
});
it('TC-DASH-05b: extracts DTN from DTN: prefix format', () => {
expect(getDocumentIdFromQrText('DTN:DTN-2026-0001|extra'))
.toBe('DTN-2026-0001');
});
it('TC-DASH-05c: extracts bare DTN-YYYY-NNNN pattern', () => {
expect(getDocumentIdFromQrText('Reference: DTN-2026-0042'))
.toBe('DTN-2026-0042');
});
it('TC-DASH-05d: returns null for unrecognised text', () => {
expect(getDocumentIdFromQrText('random text')).toBeNull();
});
});
describe('parseStoredList', () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key in storage ? storage[key] : null),
      setItem: (key: string, value: string) => {
        storage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        Object.keys(storage).forEach((key) => delete storage[key]);
      },
    });
  });

  it('TC-DASH-06a: returns parsed array from valid localStorage entry', () => {
localStorage.setItem('customDocumentTypes',
JSON.stringify(['Memorandum', 'Letter']));
expect(parseStoredList('customDocumentTypes'))
.toEqual(['Memorandum', 'Letter']);
});
it('TC-DASH-06b: returns [] when key is absent', () => {
expect(parseStoredList('neverSet')).toEqual([]);
});
it('TC-DASH-06c: returns [] and clears key on malformed JSON', () => {
localStorage.setItem('badKey', '{not: valid}');
expect(parseStoredList('badKey')).toEqual([]);
expect(localStorage.getItem('badKey')).toBeNull();
});
it('TC-DASH-06d: returns [] when stored value is not an array', () => {
localStorage.setItem('objKey', JSON.stringify({ x: 1 }));
expect(parseStoredList('objKey')).toEqual([]);
});
});
describe('stats derivation logic', () => {
  const computeStats = (docs: Array<{ status: string }>) => ({
    pending: docs.filter((d) => d.status === 'Pending').length,
    processing: docs.filter((d) => d.status === 'Processing').length,
    overdue: docs.filter((d) => d.status === 'Overdue').length,
    sentForApproval: docs.filter((d) => d.status === 'Sent for approval').length,
    needsRevision: docs.filter((d) => d.status === 'Needs revision').length,
    approvedCompleted: docs.filter((d) =>
      ['Approved', 'Released', 'Completed'].includes(d.status),
    ).length,
  });
it('TC-DASH-07a: counts each status group correctly', () => {
const docs = [
{ status: 'Pending' }, { status: 'Pending' },
{ status: 'Overdue' }, { status: 'Sent for approval' },
{ status: 'Completed' },
];
const s = computeStats(docs);
expect(s.pending).toBe(2);
expect(s.overdue).toBe(1);
expect(s.sentForApproval).toBe(1);
expect(s.approvedCompleted).toBe(1);
expect(s.processing).toBe(0);
});
it('TC-DASH-07b: Released and Approved both count in approvedCompleted', () => {
const docs = [{ status:'Released' },{ status:'Approved' },{ status:'Completed' }];
expect(computeStats(docs).approvedCompleted).toBe(3);
});
it('TC-DASH-07c: empty array → all stats zero', () => {
Object.values(computeStats([])).forEach(v => expect(v).toBe(0));
});
});
describe('getVisibleDocuments logic', () => {
  const filterByRole = (
    docs: Array<{ assignedTo?: string; archived?: boolean }>,
    user: { role: string; email: string },
  ) =>
    user.role === 'staff'
      ? docs.filter((d) => d.assignedTo === user.email)
      : docs;

  const filterByTab = (
    docs: Array<{ archived?: boolean; destination?: string | null }>,
    tab: string,
  ) => {
    if (tab === 'archived') return docs.filter((d) => d.archived);
    const active = docs.filter((d) => !d.archived);
    if (tab === 'incoming') return active.filter((d) => !d.destination);
    if (tab === 'outgoing') return active.filter((d) => d.destination);
    return active;
  };
it('TC-DASH-08a: staff sees only their assigned docs', () => {
const docs = [
{ assignedTo: 'ana@example.com', archived: false },
{ assignedTo: 'ana@example.com', archived: false },
{ assignedTo: 'other@example.com', archived: false },
];
expect(filterByRole(docs, { role:'staff', email:'ana@example.com' })).toHaveLength(2);
});
it('TC-DASH-08b: admin sees all documents', () => {
const docs = [{ assignedTo:'a@x.com' },{ assignedTo:'b@x.com' }];
expect(filterByRole(docs, { role:'admin', email:'admin@x.com' })).toHaveLength(2);
});
it('TC-DASH-08c: archived tab shows only archived docs', () => {
const docs = [{ archived:true },{ archived:false },{ archived:true }];
expect(filterByTab(docs, 'archived')).toHaveLength(2);
});
it('TC-DASH-08d: outgoing tab shows only docs with a destination', () => {
const docs = [
{ archived:false, destination:"Mayor's Office" },
{ archived:false, destination:null },
{ archived:false, destination:'' },
];
expect(filterByTab(docs, 'outgoing')).toHaveLength(1);
});
it('TC-DASH-08e: incoming tab shows non-archived docs without destination', () => {
const docs = [
{ archived:false, destination:null },
{ archived:false, destination:"Office" },
{ archived:true, destination:null },
];
expect(filterByTab(docs, 'incoming')).toHaveLength(1);
});
});
describe('filteredDocuments search and status logic', () => {
  const searchFilter = (
    docs: Array<{ id: string; title: string }>,
    q: string,
  ) =>
    docs.filter(
      (d) =>
        d.id.toLowerCase().includes(q.toLowerCase()) ||
        d.title.toLowerCase().includes(q.toLowerCase()),
    );

  const statusFilter = (
    docs: Array<{ status: string }>,
    sel: string,
  ) =>
    docs.filter((d) =>
      sel === 'all'
        ? true
        : sel === 'approved-completed'
        ? ['Approved', 'Released', 'Completed'].includes(d.status)
        : d.status === sel,
    );
it('TC-DASH-09a: case-insensitive title search', () => {
const docs = [
{ id:'DTN-001', title:'Permit Application' },
{ id:'DTN-002', title:'Budget Proposal' },
];
expect(searchFilter(docs, 'permit')).toHaveLength(1);
expect(searchFilter(docs, 'PERMIT')).toHaveLength(1);
});
it('TC-DASH-09b: DTN search matches by ID', () => {
const docs = [{ id:'DTN-2026-0001', title:'Doc A' },{ id:'DTN-2026-0002', title:'Doc B' }];
expect(searchFilter(docs, 'DTN-2026-0001')).toHaveLength(1);
});
it('TC-DASH-09c: empty query returns all docs', () => {
const docs = [{ id:'A', title:'X' },{ id:'B', title:'Y' }];
expect(searchFilter(docs, '')).toHaveLength(2);
});
it('TC-DASH-09d: no match returns empty array', () => {
expect(searchFilter([{ id:'DTN-001', title:'Permit' }], 'zzz')).toHaveLength(0);
});
it('TC-DASH-09e: approved-completed group includes Approved, Released, Completed', () => {
const docs = [
{ status:'Approved' },{ status:'Released' },
{ status:'Completed' },{ status:'Pending' },
];
expect(statusFilter(docs, 'approved-completed')).toHaveLength(3);
});
it('TC-DASH-09f: exact status filter returns only matching docs', () => {
const docs = [{ status:'Pending' },{ status:'Pending' },{ status:'Overdue' }];
expect(statusFilter(docs, 'Pending')).toHaveLength(2);
});
});
