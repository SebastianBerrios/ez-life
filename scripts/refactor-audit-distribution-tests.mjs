import { readFileSync, writeFileSync } from 'node:fs';
const path = 'src/presentation/components/OnboardingStep2.test.tsx';
let source = readFileSync(path, 'utf8');
source = source.replace("describe('OnboardingStep2', () => {", `const echoSaveSet = (save = echoSave()) => vi.fn((_userId: string, rows: unknown[]) => Promise.all(rows.map(row => save(row))));
describe('OnboardingStep2', () => {`);
source = source.replaceAll('saveDistributionCategory: mockSave,', 'saveDistributionSet: echoSaveSet(mockSave),');
source = source.replaceAll('saveDistributionCategory: echoSave(),', 'saveDistributionSet: echoSaveSet(),');
writeFileSync(path, source);
