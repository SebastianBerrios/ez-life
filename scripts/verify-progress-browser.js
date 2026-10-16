async page => {
  // Dedicated CLI browser context with synthetic local data; no OAuth or remote writes.
  const origin = 'http://localhost:3103';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().setOffline(false);
  await page.goto(origin);
  await page.evaluate(() => localStorage.setItem('ezlife.activeAccount.v1', JSON.stringify({ id: 'progress-user' })));
  await page.reload();
  await page.getByText(/Paso 1: Configuración Básica|Balance del Mes/).waitFor();
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ezlife-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const names = ['profiles', 'income_sources', 'distribution_categories', 'expense_categories', 'expense_subcategories', 'movements', 'sync_queue'];
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(names, 'readwrite'); const now = new Date();
      const base = { user_id: 'progress-user', created_at: now, updated_at: now };
      transaction.objectStore('movements').clear(); transaction.objectStore('sync_queue').clear();
      transaction.objectStore('profiles').put({ id: 'progress-user', created_at: now, updated_at: now });
      transaction.objectStore('income_sources').put({ ...base, id: 'audit-source', name: 'Sueldo de prueba', amount: 100000 });
      transaction.objectStore('distribution_categories').put({ ...base, id: 'audit-bucket', name: 'Ahorro de prueba', percentage: 100, is_default: true, is_savings: true });
      transaction.objectStore('expense_categories').put({ ...base, id: 'audit-category', name: 'Gastos de prueba', distribution_category_id: 'audit-bucket' });
      transaction.objectStore('expense_subcategories').put({ id: 'audit-sub', category_id: 'audit-category', name: 'General', created_at: now, updated_at: now });
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
    }); database.close();
  });
  await page.reload(); await page.getByText('Balance del Mes').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const typography = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('h1')).fontFamily,
  }));
  if (!typography.body.includes('Jakarta') || !typography.heading.includes('Fraunces')) throw new Error(`Incorrect typography: ${JSON.stringify(typography)}`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cache = await page.evaluate(async () => ({ keys: await caches.keys(), assets: (await (await caches.open((await caches.keys()).find(key => key.startsWith('ez-life-')))).keys()).length }));
  await page.context().setOffline(true);
  await page.reload(); await page.getByText('Balance del Mes').waitFor();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Monto', { exact: true }).fill('12.34');
  await page.getByText('Opciones adicionales', { exact: true }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Escritura offline verificada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByText('Balance del Mes').waitFor();
  await page.getByText('S/ -12.34', { exact: true }).waitFor();
  await page.reload(); await page.getByText('S/ -12.34', { exact: true }).waitFor();
  const reopened = await page.context().newPage();
  await reopened.goto(origin); await reopened.getByText('S/ -12.34', { exact: true }).waitFor();
  await reopened.close(); await page.context().setOffline(false);
  const screens = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { localStorage.setItem('theme', theme); document.documentElement.classList.toggle('dark', theme === 'dark'); }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const labels = ['Resumen', 'Movimientos', 'Préstamos', 'Control', 'Análisis', 'Metas de Ahorro', 'Espacio', 'Crear', 'Mi progreso', 'Ajustes'];
      for (const label of labels) {
        if (width < 768 && !['Resumen', 'Movimientos', 'Préstamos', 'Control'].includes(label)) {
          await page.getByRole('button', { name: 'Más', exact: true }).click();
          await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
        } else {
          const nav = width < 768 ? page.getByRole('navigation', { name: 'Navegación principal' }) : page.getByRole('complementary', { name: 'Barra lateral' });
          await nav.getByRole('button', { name: label, exact: true }).click();
        }
        await page.waitForTimeout(200);
        const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
        if (dimensions.scroll > dimensions.width + 1) throw new Error(`Overflow: ${label}, ${width}, ${theme}`);
        if (label === 'Mi progreso') await page.getByText('Registro constante', { exact: true }).waitFor();
        if (['Resumen', 'Mi progreso', 'Movimientos'].includes(label)) await page.screenshot({ path: `.playwright-cli/progress-${label}-${width}-${theme}.png`, fullPage: true });
        screens.push({ label, width, theme, noOverflow: true });
      }
    }
  }
  await page.context().setOffline(true);
  await page.reload(); await page.getByText('Balance del Mes').waitFor();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi progreso', exact: true }).click();
  await page.getByText('Registro constante', { exact: true }).waitFor();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Mostrar logros personales y celebraciones').uncheck();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi progreso', exact: true }).waitFor({ state: 'hidden' });
  await page.reload(); await page.getByText('Balance del Mes').waitFor();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi progreso', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Mostrar logros personales y celebraciones').check();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi progreso', exact: true }).waitFor();
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  await page.context().setOffline(false);
  return { typography, cache, offlineReload: true, offlineWrite: true, offlineReopen: true, visibilityPersisted: true, reducedMotion: true, keyboardFocus: focused, screens };
}
