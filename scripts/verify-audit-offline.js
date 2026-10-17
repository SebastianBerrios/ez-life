async page => {
  // Dedicated CLI browser context with synthetic local data; no OAuth or remote writes.
  const origin = 'http://localhost:3100';
  await page.context().setOffline(false);
  await page.evaluate(() => localStorage.setItem('ezlife.activeAccount.v1', JSON.stringify({ id: 'audit-user' })));
  await page.reload();
  await page.getByText(/Paso 1: Configuración Básica|Resumen Ejecutivo|Resumen del ciclo/).waitFor();
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ezlife-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const names = ['profiles', 'income_sources', 'distribution_categories', 'expense_categories', 'expense_subcategories', 'movements', 'sync_queue'];
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(names, 'readwrite'); const now = new Date();
      const base = { user_id: 'audit-user', created_at: now, updated_at: now };
      transaction.objectStore('movements').clear(); transaction.objectStore('sync_queue').clear();
      transaction.objectStore('profiles').put({ id: 'audit-user', created_at: now, updated_at: now });
      transaction.objectStore('income_sources').put({ ...base, id: 'audit-source', name: 'Sueldo de prueba', amount: 100000 });
      transaction.objectStore('distribution_categories').put({ ...base, id: 'audit-bucket', name: 'Ahorro de prueba', percentage: 100, is_default: true, is_savings: true });
      transaction.objectStore('expense_categories').put({ ...base, id: 'audit-category', name: 'Gastos de prueba', distribution_category_id: 'audit-bucket' });
      transaction.objectStore('expense_subcategories').put({ id: 'audit-sub', category_id: 'audit-category', name: 'General', created_at: now, updated_at: now });
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
    }); database.close();
  });
  await page.reload(); await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cache = await page.evaluate(async () => ({ keys: await caches.keys(), assets: (await (await caches.open((await caches.keys()).find(key => key.startsWith('ez-life-')))).keys()).length }));
  await page.context().setOffline(true);
  await page.reload(); await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Monto', { exact: true }).fill('12.34');
  await page.getByLabel('Descripción', { exact: true }).fill('Escritura offline verificada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.getByText('S/ -12.34', { exact: true }).waitFor();
  await page.reload(); await page.getByText('S/ -12.34', { exact: true }).waitFor();
  const reopened = await page.context().newPage();
  await reopened.goto(origin); await reopened.getByText('S/ -12.34', { exact: true }).waitFor();
  await reopened.close(); await page.context().setOffline(false);
  return { cache, offlineReload: true, offlineWrite: true, offlineReopen: true };
}
