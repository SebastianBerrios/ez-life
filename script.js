const fs = require('fs');
const content = fs.readFileSync('plan_003.md', 'utf-8');

function extractCode(fileHeader) {
  const parts = content.split(fileHeader);
  if (parts.length < 2) return null;
  const section = parts[1];
  const codeStart = section.indexOf('\\\	sx');
  if (codeStart === -1) return null;
  const codeContentStart = codeStart + 6;
  const codeEnd = section.indexOf('\\\', codeContentStart);
  return section.substring(codeContentStart, codeEnd).trim();
}

const files = [
  { name: 'src/presentation/components/OnboardingStep1.tsx', header: 'OnboardingStep1.tsx — Fix design system tokens' },
  { name: 'src/presentation/components/MovementList.tsx', header: 'MovementList.tsx — Fix hardcoded colors' },
  { name: 'src/presentation/components/MovementForm.tsx', header: 'MovementForm.tsx — Fix UUID bug + add expense category selectors' },
  { name: 'src/presentation/components/OnboardingWizard.tsx', header: 'OnboardingWizard.tsx — Wizard unificado de 3 pasos' },
  { name: 'src/presentation/components/MainFlow.tsx', header: 'Archivo completo resultante de MainFlow.tsx:' }
];

for (const file of files) {
  const code = extractCode(file.header);
  if (code) {
    fs.writeFileSync(file.name, code);
    console.log('Wrote ' + file.name);
  } else {
    console.log('Could not find code for ' + file.name);
  }
}
