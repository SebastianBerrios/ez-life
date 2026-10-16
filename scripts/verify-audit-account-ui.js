async page => {
  await page.context().setOffline(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('ezlife.activeAccount.v1'));
    account.avatarUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="green"/></svg>');
    localStorage.setItem('ezlife.activeAccount.v1', JSON.stringify(account)); localStorage.setItem('theme', 'system');
  });
  await page.reload(); await page.getByText('Balance del Mes').waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('img[alt="Foto de perfil"]')).some(img => img.naturalWidth > 0));
  await page.getByRole('button', { name: 'Cambiar a modo claro', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('light'));
  await page.getByRole('button', { name: 'Cambiar a modo oscuro', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await page.getByRole('button', { name: 'Usar tema del sistema', exact: true }).click();
  if (await page.evaluate(() => localStorage.getItem('theme')) !== 'system') throw new Error('System theme not persisted');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Google', exact: true }).waitFor();
  await page.reload(); await page.getByRole('button', { name: 'Google', exact: true }).waitFor();
  if (await page.evaluate(() => localStorage.getItem('ezlife.activeAccount.v1')) !== null) throw new Error('Logout selection survived');
  await page.context().setOffline(false);
  return { avatar: true, themeLightDarkSystem: true, offlineLogoutAndReload: true };
}
