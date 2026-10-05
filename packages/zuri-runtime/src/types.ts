// @packet PKT-ZPA-FR-002-SCHEMA-001 @implements ZPA-FR-002 schema layer
export type ContractName = 'shell-request' | 'run-intake' | 'request-binding' | 'check-use'
  | 'approval-bundle' | 'run-event' | 'effect-receipt';
export interface AttachmentRef {
  readonly artifact_id: string;
  readonly version: number;
  readonly digest: string;
}
export interface RunIntake {
  readonly conversation_ref: string;
  readonly client_message_ref: string;
  readonly text: string;
  readonly attachment_refs: readonly AttachmentRef[];
  readonly workflow_id?: string;
}
export interface ValidationIssue {
  readonly keyword: string;
  readonly schemaPath: string;
}
export interface ValidationFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'INVALID_CONTRACT' | 'SCHEMA_INVALID' | 'DUPLICATE_ATTACHMENT';
    readonly issues: readonly ValidationIssue[];
  };
}
export type ValidationResult = { readonly ok: true } | ValidationFailure;
export type IntakeResult = { readonly ok: true; readonly value: RunIntake } | ValidationFailure;
