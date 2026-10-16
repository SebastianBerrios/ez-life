import { readFileSync, writeFileSync } from 'node:fs';
const path = 'src/presentation/components/MainFlow.tsx';
let source = readFileSync(path, 'utf8');
const start = source.indexOf("  React.useEffect(() => {\r\n    import('../../infrastructure/supabase/client')");
const lfStart = source.indexOf("  React.useEffect(() => {\n    import('../../infrastructure/supabase/client')");
const offset = start >= 0 ? start : lfStart;
if (offset < 0) throw new Error('Session effect not found');
const endMarker = '  }, [syncNow]);';
const end = source.indexOf(endMarker, offset) + endMarker.length;
source = source.slice(0, offset) + `  React.useEffect(() => observeAccountSession(syncNow, state => {
    setProfileId(state.account?.id ?? null);
    setAvatarUrl(state.account?.avatarUrl);
    setWizardStartStep(state.startStep);
    setStep(!state.account ? 'login' : state.completed ? 'app' : 'onboarding-wizard');
  }), [syncNow]);` + source.slice(end);
const offlineStart = source.indexOf("  if (step === 'onboarding-wizard' && !isOnline) {");
if (offlineStart >= 0) {
  const next = source.indexOf("  if (step === 'onboarding-wizard') {", offlineStart + 10);
  source = source.slice(0, offlineStart) + source.slice(next);
}
source = source.replace("import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';", "import { observeAccountSession } from '../../infrastructure/auth/observeAccountSession';\nimport { forgetLocalAccount } from '../../infrastructure/auth/localAccount';");
source = source.replaceAll("onLogout={() => setStep('login')}", "onLogout={() => { forgetLocalAccount(); setProfileId(null); setAvatarUrl(undefined); setStep('login'); }}");
writeFileSync(path, source);
