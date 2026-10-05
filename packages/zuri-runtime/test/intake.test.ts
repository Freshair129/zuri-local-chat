import { parseRunIntake } from '../src/intake';

// @packet PKT-ZPA-FR-002-SCHEMA-001 @verifies ZPA-FR-002
function body() {
  return { conversation_ref: '00000000-0000-4000-8000-000000000002',
    client_message_ref: '00000000-0000-4000-8000-000000000003', text: ' ไทย 😀 ',
    attachment_refs: [{ artifact_id: '00000000-0000-4000-8000-000000000004',
      version: 1, digest: 'a'.repeat(64) }] };
}
describe('PKT-ZPA-FR-002-SCHEMA-001 ZPA-FR-002', () => {
  describe('AC-02 intakeRoundTrip ZPA-FR-002', () => {
    test.each([false, true])('preserves exact values and optional presence %s', (workflow) => {
      const input = workflow ? { ...body(), workflow_id: 'workflow.1' } : body();
      const result = parseRunIntake(input);
      expect(result).toEqual({ ok: true, value: input });
      if (!result.ok) throw new Error('Expected intake');
      expect(result.value).not.toBe(input);
      expect(result.value.attachment_refs[0]).not.toBe(input.attachment_refs[0]);
      Object.assign(result.value.attachment_refs[0], { version: 2 });
      expect(input.attachment_refs[0].version).toBe(1);
    });
    test('attachment-only request is accepted', () => {
      expect(parseRunIntake({ ...body(), text: '' }).ok).toBe(true);
    });
  });
  describe('AC-03 attachmentIdentity ZPA-FR-002', () => {
    test('same artifact with changed version/digest is denied', () => {
      const input = body();
      input.attachment_refs.push({ ...input.attachment_refs[0], version: 2, digest: 'b'.repeat(64) });
      expect(parseRunIntake(input)).toEqual({ ok: false,
        error: { code: 'DUPLICATE_ATTACHMENT', issues: [] } });
    });
    test('distinct artifacts are accepted', () => {
      const input = body();
      input.attachment_refs.push({ ...input.attachment_refs[0],
        artifact_id: '00000000-0000-4000-8000-000000000005' });
      expect(parseRunIntake(input).ok).toBe(true);
    });
    test('schema failure remains a typed denial', () => {
      expect(parseRunIntake({ ...body(), text: null }).ok).toBe(false);
    });
  });
});
