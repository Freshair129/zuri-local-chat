import Ajv2020 from 'ajv/dist/2020';
import type { ContractName } from '../src/types';
import { validateWireShape } from '../src/validation';
import fixtures from './fixtures/schema-cases.json';

// @packet PKT-ZPA-FR-002-SCHEMA-001 @verifies ZPA-FR-002
const cases: readonly { id: string; schema: string; expected_valid: boolean;
  expected_keyword: string | null; instance: unknown }[] = fixtures.cases;
const names: readonly ContractName[] = ['shell-request', 'run-intake', 'request-binding',
  'check-use', 'approval-bundle', 'run-event', 'effect-receipt'];
function contract(schema: string): ContractName {
  const found = names.find((name) => name + '.schema.json' === schema);
  if (!found) throw new Error('Unknown fixture contract');
  return found;
}
function intake() {
  return { conversation_ref: '00000000-0000-4000-8000-000000000002',
    client_message_ref: '00000000-0000-4000-8000-000000000003', text: 'ไทย 😀', attachment_refs: [] };
}
describe('PKT-ZPA-FR-002-SCHEMA-001 ZPA-FR-002', () => {
  describe('AC-01 fixtureParity ZPA-FR-002', () => {
    test('all 57 distinct fixtures and seven roots are present', () => {
      expect(cases).toHaveLength(57);
      expect(new Set(cases.map((c) => c.id)).size).toBe(57);
      expect(new Set(cases.map((c) => c.schema)).size).toBe(7);
    });
    test.each(cases)('$id', (c) => {
      const before = structuredClone(c.instance);
      const result = validateWireShape(contract(c.schema), c.instance);
      expect(result.ok).toBe(c.expected_valid);
      if (!result.ok) expect(result.error.issues.map((i) => i.keyword)).toContain(c.expected_keyword);
      expect(c.instance).toEqual(before);
    });
  });
  describe('AC-04 strictInput ZPA-FR-002', () => {
    test('rejects stringified attachment version without coercion', () => {
      const input = { ...intake(), attachment_refs: [{
        artifact_id: '00000000-0000-4000-8000-000000000004',
        version: '1', digest: 'a'.repeat(64),
      }] };
      expect(validateWireShape('run-intake', input).ok).toBe(false);
      expect(input.attachment_refs[0].version).toBe('1');
    });
    test.each([16, 17])('distinct attachment boundary %i', (count) => {
      const attachment_refs = Array.from({ length: count }, (_, i) => ({
        artifact_id: '00000000-0000-4000-8000-' + (i + 1).toString(16).padStart(12, '0'),
        version: 1, digest: 'a'.repeat(64),
      }));
      expect(validateWireShape('run-intake', { ...intake(), attachment_refs }).ok).toBe(count === 16);
    });

    test.each([null, [], {}, { ...intake(), caller_secret: 'secret' },
      { ...intake(), text: 3 }, { ...intake(), text: '😀'.repeat(32769) },
      Object.create(intake())])('rejects invalid/unknown/inherited input %#', (input: unknown) => {
      expect(validateWireShape('run-intake', input).ok).toBe(false);
    });
    test('astral boundary and frozen input remain unchanged', () => {
      const input = Object.freeze({ ...intake(), text: '😀'.repeat(32768),
        attachment_refs: Object.freeze([]) });
      expect(validateWireShape('run-intake', input)).toEqual({ ok: true });
    });
  });
  describe('AC-05 formatBoundaries ZPA-FR-002', () => {
    test.each(['\n', '\r\n'])('rejects UUID terminal line ending %#', (suffix) => {
      expect(validateWireShape('run-intake', {
        ...intake(), conversation_ref: intake().conversation_ref + suffix,
      }).ok).toBe(false);
    });

    const sample = cases.find((c) => c.id === 'run-event-valid')!.instance;
    test.each(['2026-02-30T00:00:00Z', '2026-01-01T00:00:60Z', '0000-01-01T00:00:00Z',
      '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00Z\n'])('rejects %s', (time) => {
      expect(validateWireShape('run-event', Object.assign({}, sample, { occurred_at: time })).ok).toBe(false);
    });
    test.each(['2024-02-29T23:59:59Z', '2026-10-05T12:00:00.123456789Z'])('accepts %s', (time) => {
      expect(validateWireShape('run-event', Object.assign({}, sample, { occurred_at: time })).ok).toBe(true);
    });
  });
  describe('AC-06 contractAllowlist ZPA-FR-002', () => {
    test.each(['common', '__proto__', 'toString', 'other'])('rejects %s', (name) => {
      // @ts-expect-error Deliberately exercise the JavaScript boundary.
      expect(validateWireShape(name, {})).toEqual({ ok: false,
        error: { code: 'INVALID_CONTRACT', issues: [] } });
    });
  });
  describe('AC-07 localRegistry ZPA-FR-002', () => {
    test('corrupt local reference fails real compilation without network', () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      jest.resetModules();
      jest.doMock('../src/schemas/common.schema.json', () => ({ $id: 'https://invalid.invalid/missing', $defs: {} }));
      try {
        expect(() => jest.isolateModules(() => require('../src/validation'))).toThrow();
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        jest.dontMock('../src/schemas/common.schema.json');
        jest.resetModules();
        fetchSpy.mockRestore();
      }
    });
    test('Ajv has no implicit remote fallback for missing references', () => {
      expect(() => new Ajv2020().compile({ $ref: 'https://invalid.invalid/absent' })).toThrow();
    });
  });
  describe('AC-08 safeErrors ZPA-FR-002', () => {
    test('does not echo values or unknown property names; caps issues', () => {
      const secret = 'private-payload-unique';
      const input = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [secret + i, secret]));
      const result = validateWireShape('run-intake', input);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected denial');
      expect(result.error.code).toBe('SCHEMA_INVALID');
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues.length).toBeLessThanOrEqual(16);
      expect(JSON.stringify(result)).not.toContain(secret);
      for (const issue of result.error.issues) expect(Object.keys(issue).sort()).toEqual(['keyword', 'schemaPath']);
    });
  });
});
