async page => {
  await page.context().setOffline(true);
  const results = [];
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload(); await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
    const navigation = width < 768 ? page.getByRole('navigation', { name: 'Navegación principal' }) : page.getByRole('complementary', { name: 'Barra lateral' });
    await navigation.getByRole('button', { name: 'Finanzas', exact: true }).click();
    await page.getByText('Escritura offline verificada').first().waitFor();
    // Spec 010: edit lives in the row menu ("Acciones de ..."), not in an always-visible button.
    await page.getByRole('button', { name: /^Acciones de Escritura offline verificada/ }).click();
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
    await page.getByText('Editar Movimiento', { exact: true }).waitFor();
    const dialog = await page.getByRole('dialog').boundingBox();
    if (!dialog || dialog.x < 0 || dialog.x + dialog.width > width + 1) throw new Error(`Dialog overflows at ${width}`);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    if (dimensions.scroll > dimensions.width + 1) throw new Error(`Page overflows at ${width}: ${JSON.stringify(dimensions)}`);
    await navigation.getByRole('button', { name: width < 768 ? 'Inicio' : 'Resumen', exact: true }).click();
    await page.getByRole('heading', { name: /Resumen Ejecutivo|Resumen del ciclo/ }).waitFor();
    results.push({ width, navigation: true, editing: true, noOverflow: true });
  }
  await page.context().setOffline(false);
  return results;
}
