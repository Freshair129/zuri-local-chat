import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ContractName, ValidationResult } from './types';
import approval from './schemas/approval-bundle.schema.json';
import binding from './schemas/request-binding.schema.json';
import receipt from './schemas/effect-receipt.schema.json';
import shell from './schemas/shell-request.schema.json';
import intake from './schemas/run-intake.schema.json';
import event from './schemas/run-event.schema.json';
import common from './schemas/common.schema.json';
import use from './schemas/check-use.schema.json';
import { isUtcDateTime } from './formats';

// @packet PKT-ZPA-FR-002-SCHEMA-001 @implements ZPA-FR-002 schema layer
const ajv = new Ajv2020({
  strict: true,
  // Approved exception: nested anyOf constraints inherit their types from outer properties.
  strictTypes: false,
  strictSchema: true,
  strictNumbers: true,
  ownProperties: true,
  validateFormats: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  allErrors: true,
});
addFormats(ajv, ['uuid']);
ajv.addFormat('date-time', { type: 'string', validate: isUtcDateTime });
const roots = {
  'shell-request': shell,
  'run-intake': intake,
  'request-binding': binding,
  'check-use': use,
  'approval-bundle': approval,
  'run-event': event,
  'effect-receipt': receipt,
};
ajv.addSchema(common);
for (const schema of Object.values(roots)) ajv.addSchema(schema);
const validators = new Map(Object.entries(roots).map(([name, schema]) => {
  const validate = ajv.getSchema(schema.$id);
  if (!validate) throw new Error('Missing bundled contract');
  return [name, validate] as const;
}));

/** Structural validation only; it never establishes authority or signature validity. */
export function validateWireShape(contract: ContractName, input: unknown): ValidationResult {
  const validate = validators.get(contract);
  if (!validate) return { ok: false, error: { code: 'INVALID_CONTRACT', issues: [] } };
  if (validate(input)) return { ok: true };
  return { ok: false, error: { code: 'SCHEMA_INVALID',
    issues: (validate.errors ?? []).slice(0, 16).map(({ keyword, schemaPath }) => ({ keyword, schemaPath })) } };
}
