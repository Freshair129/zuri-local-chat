import type { IntakeResult, RunIntake } from './types';
import { validateWireShape } from './validation';

// @packet PKT-ZPA-FR-002-SCHEMA-001 @implements ZPA-FR-002 schema layer
// @component CMP-ZPA-INTAKE-CONTRACT-001
export function parseRunIntake(input: unknown): IntakeResult {
  const result = validateWireShape('run-intake', input);
  if (!result.ok) return result;
  // This boundary cast follows successful validation of this exact input and schema.
  const body = input as RunIntake;
  const seen = new Set<string>();
  for (const ref of body.attachment_refs) {
    if (seen.has(ref.artifact_id)) {
      return { ok: false, error: { code: 'DUPLICATE_ATTACHMENT', issues: [] } };
    }
    seen.add(ref.artifact_id);
  }
  const value: RunIntake = {
    conversation_ref: body.conversation_ref,
    client_message_ref: body.client_message_ref,
    text: body.text,
    attachment_refs: body.attachment_refs.map((ref) => ({
      artifact_id: ref.artifact_id, version: ref.version, digest: ref.digest,
    })),
    ...(Object.hasOwn(body, 'workflow_id') ? { workflow_id: body.workflow_id } : {}),
  };
  return { ok: true, value };
}
