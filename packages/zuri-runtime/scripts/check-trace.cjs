const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const packet = 'PKT-ZPA-FR-002-SCHEMA-001';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/approved-subjects.json'), 'utf8'));
const errors = [];
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const expect = (ok, message) => { if (!ok) errors.push(message); };
const acFiles = {
  'AC-01': 'test/contracts.test.ts', 'AC-02': 'test/intake.test.ts',
  'AC-03': 'test/intake.test.ts', 'AC-04': 'test/contracts.test.ts',
  'AC-05': 'test/contracts.test.ts', 'AC-06': 'test/contracts.test.ts',
  'AC-07': 'test/contracts.test.ts', 'AC-08': 'test/contracts.test.ts',
  'AC-09': 'test/typecheck.ts', 'AC-10': 'test/provenance.test.ts',
};
const symbols = {
  'src/types.ts': ['ContractName', 'AttachmentRef', 'RunIntake', 'ValidationIssue',
    'ValidationFailure', 'ValidationResult', 'IntakeResult'],
  'src/validation.ts': ['validateWireShape'],
  'src/intake.ts': ['parseRunIntake'],
  'src/formats.ts': ['isUtcDateTime'],
};
try {
  expect(manifest.packet === packet && manifest.approval === 'M1-002', 'Approval/packet identity');
  expect(manifest.subjects.length === 9, 'Expected eight schemas and one fixture file');
  for (const subject of manifest.subjects) {
    expect(!path.isAbsolute(subject.path) && !subject.path.split(/[\\/]/).includes('..'), 'Unsafe subject path');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, subject.path))).digest('hex');
    expect(hash === subject.sha256, 'Subject drift: ' + subject.path);
  }
  for (const [file, names] of Object.entries(symbols)) {
    const text = read(file);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const declared = new Set(source.statements.filter((node) => node.name && ts.isIdentifier(node.name)).map((node) => node.name.text));
    expect(names.every((name) => declared.has(name)), 'Missing component symbol: ' + file);
    expect(text.includes(packet) && text.includes('@implements ZPA-FR-002'), 'Missing source trace: ' + file);
  }
  expect(read('src/intake.ts').includes('@component CMP-ZPA-INTAKE-CONTRACT-001'), 'Missing CMP identity');
  const testLabels = new Map();
  function callRoot(expression) {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression) || ts.isCallExpression(expression)) return callRoot(expression.expression);
    return '';
  }
  for (const file of new Set(Object.values(acFiles))) {
    const text = read(file);
    expect(text.includes(packet) && text.includes('@verifies ZPA-FR-002'), 'Missing test annotation: ' + file);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const labels = [];
    function visit(node, parents = []) {
      if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
        const kind = callRoot(node.expression);
        const name = [...parents, node.arguments[0].text];
        if (kind === 'describe') {
          ts.forEachChild(node, (child) => visit(child, name));
          return;
        }
        if (kind === 'test' || kind === 'it') {
          const fullName = name.join(' ');
          labels.push(fullName);
          expect(fullName.includes(packet) && fullName.includes('ZPA-FR-002') && /AC-\d{2}/.test(fullName), 'Missing executable lineage: ' + file);
        }
      }
      ts.forEachChild(node, (child) => visit(child, parents));
    }
    visit(source);
    testLabels.set(file, labels);
    if (file === 'test/typecheck.ts') {
      expect(source.statements.some((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'typeAssertions')
        && text.includes('AC-09') && text.includes('@ts-expect-error'), 'Missing compile-only AC09');
    } else {
      expect(labels.length > 0, 'No named tests: ' + file);
    }
  }
  for (const [id, file] of Object.entries(acFiles)) {
    if (id !== 'AC-09') expect(testLabels.get(file).some((name) => name.includes(id)), 'Missing AC-named test: ' + id);
  }
  const fixtures = JSON.parse(read('test/fixtures/schema-cases.json')).cases;
  expect(fixtures.length === 57 && new Set(fixtures.map((item) => item.id)).size === 57, 'Fixture identity/count');
  const allowed = new Set(['package.json', 'tsconfig.json', 'jest.config.cjs', '.gitignore',
    'src/index.ts', ...Object.keys(symbols), ...Object.values(acFiles),
    'test/fixtures/approved-subjects.json', 'scripts/check-trace.cjs', ...manifest.subjects.map((item) => item.path)]);
  function walk(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.build', 'coverage', 'node_modules'].includes(entry.name)) continue;
      const name = prefix + entry.name;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), name + '/');
      else expect(allowed.has(name), 'Unexpected packet file: ' + name);
    }
  }
  for (const file of allowed) expect(fs.existsSync(path.join(root, file)), 'Missing file: ' + file);
  walk(root);
} catch (error) {
  errors.push(error instanceof Error ? error.message : 'Trace check failed');
}
console.log(JSON.stringify({ packet, errors, warnings: [], acCount: 10, scope: 'packet-local static trace only' }));
process.exitCode = errors.length ? 1 : 0;
