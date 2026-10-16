async page => {
  await page.context().setOffline(true);
  const results = [];
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload(); await page.getByText('Balance del Mes').waitFor();
    const navigation = width < 768 ? page.getByRole('navigation', { name: 'Navegación principal' }) : page.getByRole('complementary', { name: 'Barra lateral' });
    await navigation.getByRole('button', { name: 'Movimientos', exact: true }).click();
    await page.getByText('Escritura offline verificada').waitFor();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByText('Editar Movimiento', { exact: true }).waitFor();
    const dialog = await page.getByRole('dialog').boundingBox();
    if (!dialog || dialog.x < 0 || dialog.x + dialog.width > width + 1) throw new Error(`Dialog overflows at ${width}`);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    if (dimensions.scroll > dimensions.width + 1) throw new Error(`Page overflows at ${width}: ${JSON.stringify(dimensions)}`);
    await navigation.getByRole('button', { name: 'Resumen', exact: true }).click();
    await page.getByText('Balance del Mes').waitFor();
    results.push({ width, navigation: true, editing: true, noOverflow: true });
  }
  await page.context().setOffline(false);
  return results;
}
