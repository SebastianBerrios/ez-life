async page => {
  const screens = [];
  const inspect = async stage => {
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => { localStorage.setItem('theme', theme); document.documentElement.classList.toggle('dark', theme === 'dark'); }, theme);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) throw new Error(`Overflow: ${stage}, ${width}, ${theme}`);
      await page.screenshot({ path: `.playwright-cli/progress-${stage}-${width}-${theme}.png`, fullPage: true });
      screens.push({ stage, width, theme, noOverflow: true });
    }
    await page.setViewportSize({ width: 390, height: 900 });
  };
  await page.context().setOffline(false); await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('http://localhost:3103');
  await page.evaluate(() => localStorage.removeItem('ezlife.activeAccount.v1'));
  await page.reload(); await page.getByRole('button', { name: 'Google', exact: true }).waitFor();
  await inspect('login');
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ezlife-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['profiles'], 'readwrite'); const now = new Date();
      transaction.objectStore('profiles').put({ id: 'progress-wizard', onboarding_step: 0, created_at: now, updated_at: now });
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
    }); database.close();
    localStorage.setItem('ezlife.activeAccount.v1', JSON.stringify({ id: 'progress-wizard' }));
  });
  await page.reload(); await page.getByText('Paso 1: Configuración Básica').waitFor();
  await inspect('onboarding-1');
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);
  await page.getByLabel('Sueldo o Ingreso Base (Mensual)').fill('1000.00');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByText('Tu distribución de ingresos').waitFor();
  await inspect('onboarding-2');
  await page.reload(); await page.getByText('Tu distribución de ingresos').waitFor();
  await page.getByRole('button', { name: 'Guardar distribución', exact: true }).click();
  await page.getByText('Categorías de gasto', { exact: true }).waitFor();
  await inspect('onboarding-3');
  await page.getByRole('button', { name: 'Finalizar configuración', exact: true }).click();
  await page.getByText('Balance del Mes').waitFor();
  await page.reload(); await page.getByText('Balance del Mes').waitFor();
  const state = await page.evaluate(async () => {
    const database = await new Promise(resolve => { const request = indexedDB.open('ezlife-db'); request.onsuccess = () => resolve(request.result); });
    const transaction = database.transaction(['profiles', 'income_sources']);
    const profile = await new Promise(resolve => { const request = transaction.objectStore('profiles').get('progress-wizard'); request.onsuccess = () => resolve(request.result); });
    const sources = await new Promise(resolve => { const request = transaction.objectStore('income_sources').getAll(); request.onsuccess = () => resolve(request.result.filter(row => row.user_id === 'progress-wizard')); });
    database.close(); return { completedStep: profile.onboarding_step, sources: sources.length };
  });
  if (state.completedStep !== 3 || state.sources !== 1) throw new Error(JSON.stringify(state));
  await page.context().setOffline(false); return { offlineSetupAndResume: true, screens, ...state };
}
