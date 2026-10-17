/**
 * Triggers a browser download of `content` as a text file (object URL + temporary anchor).
 * Shared by every "Exportar CSV" entry point (Ajustes and Finanzas).
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    // Revoke on the next tick: some browsers start the download asynchronously after click().
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
