import os

with open('plan_003.md', 'r', encoding='utf-8') as f:
    content = f.read()

def extract_code(header):
    parts = content.split(header)
    if len(parts) < 2: return None
    section = parts[1]
    code_start = section.find('```tsx')
    if code_start == -1: return None
    code_content_start = code_start + 6
    code_end = section.find('```', code_content_start)
    return section[code_content_start:code_end].strip()

files = [
  {'name': 'src/presentation/components/OnboardingStep1.tsx', 'header': 'OnboardingStep1.tsx — Fix design system tokens'},
  {'name': 'src/presentation/components/MovementList.tsx', 'header': 'MovementList.tsx — Fix hardcoded colors'},
  {'name': 'src/presentation/components/MovementForm.tsx', 'header': 'MovementForm.tsx — Fix UUID bug + add expense category selectors'},
  {'name': 'src/presentation/components/OnboardingWizard.tsx', 'header': 'OnboardingWizard.tsx — Wizard unificado de 3 pasos'},
  {'name': 'src/presentation/components/MainFlow.tsx', 'header': 'Archivo completo resultante de MainFlow.tsx:'}
]

for file in files:
    code = extract_code(file['header'])
    if code:
        with open(file['name'], 'w', encoding='utf-8') as f:
            f.write(code + "\n")
        print('Wrote ' + file['name'])
    else:
        print('Could not find code for ' + file['name'])
