import type { IntakeResult, RunIntake, ContractName } from '../src/types';

// @packet PKT-ZPA-FR-002-SCHEMA-001 @verifies ZPA-FR-002 AC-09 typeAssertions
function typeAssertions(result: IntakeResult, input: RunIntake) {
  if (result.ok) {
    const text: string = result.value.text;
    void text;
    // @ts-expect-error Failure is not available in the success arm.
    void result.error;
  } else {
    const code: string = result.error.code;
    void code;
    // @ts-expect-error No value exists on the denial arm.
    void result.value;
  }
  // @ts-expect-error Intake fields are readonly.
  input.text = 'mutated';
  // @ts-expect-error Attachments are readonly.
  input.attachment_refs.push({ artifact_id: '', version: 1, digest: '' });
  // @ts-expect-error Closed contract vocabulary.
  const invalid: ContractName = 'common';
  void invalid;
}
void typeAssertions;
