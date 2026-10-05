import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import manifest from './fixtures/approved-subjects.json';

// @packet PKT-ZPA-FR-002-SCHEMA-001 @verifies ZPA-FR-002 AC-10 sourceIdentity
describe('PKT-ZPA-FR-002-SCHEMA-001 ZPA-FR-002', () => {
  test('AC-10 sourceIdentity all original inputs match M1-002 hashes', () => {
    expect(manifest.subjects).toHaveLength(9);
    for (const subject of manifest.subjects) {
      const bytes = readFileSync(resolve(__dirname, '../..', subject.path));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(subject.sha256);
    }
  });
});
