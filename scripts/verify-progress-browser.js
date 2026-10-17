async page => {
  // Dedicated CLI browser context with synthetic local data; no OAuth or remote writes.
  const origin = 'http://localhost:3103';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().setOffline(false);
  await page.goto(origin);
  await page.evaluate(() => localStorage.setItem('ezlife.activeAccount.v1', JSON.stringify({ id: 'progress-user' })));
  await page.reload();
  await page.getByText(/Paso 1: Configuración Básica|Resumen Ejecutivo|Resumen del ciclo/).waitFor();
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
  await page.reload(); await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const typography = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('h1')).fontFamily,
  }));
  if (!/geist/i.test(typography.body) || !/geist/i.test(typography.heading)) throw new Error(`Incorrect typography: ${JSON.stringify(typography)}`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cache = await page.evaluate(async () => ({ keys: await caches.keys(), assets: (await (await caches.open((await caches.keys()).find(key => key.startsWith('ez-life-')))).keys()).length }));
  await page.context().setOffline(true);
  await page.reload(); await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.getByRole('button', { name: 'Nuevo Registro', exact: true }).click();
  // Spec 010 "Nuevo Registro" sheet (Gasto tab): amount, concept (always visible) and the first
  // expense category card is pre-selected; "Opciones adicionales" is no longer needed.
  await page.getByRole('dialog', { name: 'Nuevo Registro' }).waitFor();
  await page.getByLabel('Monto', { exact: true }).fill('12.34');
  await page.getByLabel('Concepto / descripción', { exact: true }).fill('Escritura offline verificada');
  await page.getByRole('button', { name: 'Guardar Registro', exact: true }).click();
  await page.getByRole('dialog', { name: 'Nuevo Registro' }).waitFor({ state: 'detached' });
  await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.getByText('Escritura offline verificada').first().waitFor();
  await page.reload(); await page.getByText('Escritura offline verificada').first().waitFor();
  const reopened = await page.context().newPage();
  await reopened.goto(origin); await reopened.getByText('Escritura offline verificada').first().waitFor();
  await reopened.close(); await page.context().setOffline(false);
  const screens = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { localStorage.setItem('theme', theme); document.documentElement.classList.toggle('dark', theme === 'dark'); }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // Spec 010 navigation: 6 desktop destinations; mobile has Inicio/Finanzas/+/Hábitos/Ajustes and
      // reaches Espacio compartido / Mi progreso through the entry rows on Inicio and Ajustes.
      const routes = [
        { id: 'dashboard', desktop: 'Resumen', mobile: 'Inicio' },
        { id: 'finances', desktop: 'Finanzas', mobile: 'Finanzas' },
        { id: 'control', desktop: 'Control & Hábitos', mobile: 'Hábitos' },
        { id: 'shared-space', desktop: 'Espacio Compartido', mobile: 'Espacio compartido', mobileRow: true },
        { id: 'progress', desktop: 'Mi Progreso', mobile: 'Mi progreso', mobileRow: true },
        { id: 'settings', desktop: 'Ajustes', mobile: 'Ajustes' },
      ];
      for (const route of routes) {
        const label = route.id;
        if (width >= 768) {
          await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: route.desktop, exact: true }).click();
        } else {
          const mobileNav = page.getByRole('navigation', { name: 'Navegación principal' });
          if (route.mobileRow) {
            await mobileNav.getByRole('button', { name: 'Inicio', exact: true }).click();
            // Mi progreso has its own card on Inicio (4b); only Espacio compartido keeps an entry row.
            if (route.id === 'progress') await page.getByRole('main').getByRole('button', { name: /Mi progreso/i }).first().click();
            else await page.getByTestId('mobile-route-links').getByRole('button', { name: route.mobile, exact: true }).click();
          } else {
            await mobileNav.getByRole('button', { name: route.mobile, exact: true }).click();
          }
        }
        await page.waitForTimeout(200);
        const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
        if (dimensions.scroll > dimensions.width + 1) throw new Error(`Overflow: ${label}, ${width}, ${theme}`);
        if (label === 'progress') await page.getByText('Registro constante', { exact: true }).waitFor();
        if (['dashboard', 'progress', 'finances'].includes(label)) await page.screenshot({ path: `.playwright-cli/progress-${label}-${width}-${theme}.png`, fullPage: true });
        screens.push({ label, width, theme, noOverflow: true });
      }
    }
  }
  await page.context().setOffline(true);
  await page.reload(); await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi Progreso', exact: true }).click();
  await page.getByText('Registro constante', { exact: true }).waitFor();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByRole('switch', { name: 'Mostrar logros personales y celebraciones' }).click(); // Switch (was a checkbox): turns it off
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi Progreso', exact: true }).waitFor({ state: 'hidden' });
  await page.reload(); await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi Progreso', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByRole('switch', { name: 'Mostrar logros personales y celebraciones' }).click(); // turns it back on
  await page.getByRole('complementary', { name: 'Barra lateral' }).getByRole('button', { name: 'Mi Progreso', exact: true }).waitFor();
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  await page.context().setOffline(false);
  return { typography, cache, offlineReload: true, offlineWrite: true, offlineReopen: true, visibilityPersisted: true, reducedMotion: true, keyboardFocus: focused, screens };
}
