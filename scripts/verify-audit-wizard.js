async page => {
  await page.context().setOffline(false); await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('http://localhost:3100');
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ezlife-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['profiles'], 'readwrite'); const now = new Date();
      transaction.objectStore('profiles').put({ id: 'audit-wizard', onboarding_step: 0, created_at: now, updated_at: now });
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
    }); database.close();
    localStorage.setItem('ezlife.activeAccount.v1', JSON.stringify({ id: 'audit-wizard' }));
  });
  await page.reload(); await page.getByText('Paso 1: Configuración Básica').waitFor();
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);
  await page.getByLabel('Sueldo o Ingreso Base (Mensual)').fill('1000.00');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByText('Tu distribución de ingresos').waitFor();
  await page.reload(); await page.getByText('Tu distribución de ingresos').waitFor();
  await page.getByRole('button', { name: 'Guardar distribución', exact: true }).click();
  await page.getByText('Categorías de gasto', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Finalizar configuración', exact: true }).click();
  await page.getByText('Balance del Mes').waitFor();
  await page.reload(); await page.getByText('Balance del Mes').waitFor();
  const state = await page.evaluate(async () => {
    const database = await new Promise(resolve => { const request = indexedDB.open('ezlife-db'); request.onsuccess = () => resolve(request.result); });
    const transaction = database.transaction(['profiles', 'income_sources']);
    const profile = await new Promise(resolve => { const request = transaction.objectStore('profiles').get('audit-wizard'); request.onsuccess = () => resolve(request.result); });
    const sources = await new Promise(resolve => { const request = transaction.objectStore('income_sources').getAll(); request.onsuccess = () => resolve(request.result.filter(row => row.user_id === 'audit-wizard')); });
    database.close(); return { completedStep: profile.onboarding_step, sources: sources.length };
  });
  if (state.completedStep !== 3 || state.sources !== 1) throw new Error(JSON.stringify(state));
  await page.context().setOffline(false); return { offlineSetupAndResume: true, ...state };
}
