// __tests__/documentWizard.utils.test.ts
// Owner: Rica Louise S. Mascunana 
// Tests pure logic extracted from client/components/DocumentWizard.tsx
// Run via: npm test (Vitest, root)

import { describe, it, expect, beforeEach } from 'vitest';
describe('isStep1Valid checker', () => {
  // Logic mirroring DocumentWizard.tsx line: const isStep1Valid = formData.title && ...
  const isStep1Valid = (f: { title?: string; documentType?: string; source?: string }) =>
    !!(f.title && f.documentType && f.source);
  it('TC-DW-01a: true when all three fields are populated', () => {
expect(isStep1Valid({
title: 'Annual Report',
documentType: 'Memorandum',
source: "Mayor's Office",
})).toBe(true);
});
it('TC-DW-01b: false when title is empty', () => {
expect(isStep1Valid({ title:'', documentType:'Memo', source:'Office' }))
.toBe(false);
});
it('TC-DW-01c: false when documentType is empty', () => {
expect(isStep1Valid({ title:'Doc', documentType:'', source:'Office' }))
.toBe(false);
});
it('TC-DW-01d: false when source is empty', () => {
expect(isStep1Valid({ title:'Doc', documentType:'Memo', source:'' }))
.toBe(false);
});
it('TC-DW-01e: false when all three fields are empty', () => {
expect(isStep1Valid({ title:'', documentType:'', source:'' })).toBe(false);
});
});
describe('isStep2Valid checker', () => {
  const isStep2Valid = (assignedTo?: string | null) => !!assignedTo;
  it('TC-DW-02a: true when assignedTo has a value', () => {
expect(isStep2Valid('ana@alubijid.gov.ph')).toBe(true);
});
it('TC-DW-02b: false when assignedTo is empty string', () => {
expect(isStep2Valid('')).toBe(false);
});
it('TC-DW-02c: false when assignedTo is undefined', () => {
expect(isStep2Valid(undefined)).toBe(false);
});
});
describe('handleNext validation logic', () => {
  const validateStep1 = (f: { title?: string; documentType?: string; source?: string }) => {
    const e = new Set<string>();
    if (!f.title) e.add('title');
    if (!f.documentType) e.add('documentType');
    if (!f.source) e.add('source');
    return e;
  };
  const validateStep2 = (f: { assignedTo?: string }) => {
    const e = new Set<string>();
    if (!f.assignedTo) e.add('assignedTo');
    return e;
  };
  it('TC-DW-03a: Step 1   all empty  , errors has title, documentType, source', () => {
const e = validateStep1({ title:'', documentType:'', source:'' });
expect(e.has('title')).toBe(true);
expect(e.has('documentType')).toBe(true);
expect(e.has('source')).toBe(true);
});
it('TC-DW-03b: Step 1   only title missing  , only title in errors', () => {
const e = validateStep1({ title:'', documentType:'Memo', source:'Office' });
expect(e.has('title')).toBe(true);
expect(e.has('documentType')).toBe(false);
});
it('TC-DW-03c: Step 1   all filled  , errors is empty, step advances', () => {
expect(validateStep1({ title:'D', documentType:'M', source:'O' }).size).toBe(0);
});
it('TC-DW-03d: Step 2   assignedTo missing  , errors has assignedTo', () => {
expect(validateStep2({ assignedTo:'' }).has('assignedTo')).toBe(true);
});
it('TC-DW-03e: Step 2   assignedTo set  , errors is empty', () => {
expect(validateStep2({ assignedTo:'ana@example.com' }).size).toBe(0);
});
});

describe('handleAddCustomDocumentType checker', () => {
  // Core logic from DocumentWizard.tsx handleAddCustomDocumentType()
  const addCustomType = (
    newName: string,
    currentTypes: string[],
  ): string[] | null => {
    const trimmed = newName.trim();
    if (!trimmed || currentTypes.includes(trimmed)) return null;
    return [...currentTypes, trimmed];
  };
  it('TC-DW-04a: adds a new unique type to an empty list', () => {
expect(addCustomType('Barangay Clearance', []))
.toEqual(['Barangay Clearance']);
});
it('TC-DW-04b: appends to existing list', () => {
expect(addCustomType('Clearance', ['Memo', 'Letter']))
.toEqual(['Memo', 'Letter', 'Clearance']);
});
it('TC-DW-04c: ignores duplicate (already in list)', () => {
expect(addCustomType('Memorandum', ['Memorandum', 'Letter'])).toBeNull();
});
it('TC-DW-04d: ignores empty string input', () => {
expect(addCustomType('', [])).toBeNull();
});
it('TC-DW-04e: ignores whitespace-only input', () => {
expect(addCustomType(' ', [])).toBeNull();
});
it('TC-DW-04f: trims surrounding whitespace before adding', () => {
    expect(addCustomType(' Clearance ', [])).toEqual(['Clearance']);
  });
});
// TC-DW-05   File upload deduplication  
describe('file deduplication checker', () => {
  const deduplicateFiles = (  // Mirrors the setSelectedFiles callback in DocumentWizard.tsx
    prev: Array<{ name: string; size: number }>,
    incoming: Array<{ name: string; size: number }>,
  ) => {
    const existing = new Set(prev.map((f) => f.name + f.size));
    const toAdd = incoming.filter((f) => !existing.has(f.name + f.size));
    return [...prev, ...toAdd];
  };
  const f = (name: string, size: number) => ({ name, size });
  it('TC-DW-05a: new unique file is added', () => {
expect(deduplicateFiles([f('a.pdf',100)], [f('b.pdf',200)])).toHaveLength(2);
});
it('TC-DW-05b: exact duplicate (same name+size) is not added', () => {
expect(deduplicateFiles([f('a.pdf',100)], [f('a.pdf',100)])).toHaveLength(1);
});
it('TC-DW-05c: same name but different size is treated as unique', () => {
expect(deduplicateFiles([f('a.pdf',100)], [f('a.pdf',999)])).toHaveLength(2);
});
it('TC-DW-05d: multiple duplicates in incoming batch all filtered', () => {
const prev = [f('a.pdf',100), f('b.pdf',200)];
const inc = [f('a.pdf',100), f('b.pdf',200), f('c.pdf',300)];
expect(deduplicateFiles(prev, inc)).toHaveLength(3);
});
it('TC-DW-05e: empty prev array   all incoming files added', () => {
expect(deduplicateFiles([], [f('x.pdf',50), f('y.pdf',60)])).toHaveLength(2);
});
});
