import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Constitution v2.1.0, Principle VI: UI copy is neutral Latin American Spanish (tuteo), never voseo.
 * Explicit list on purpose: a heuristic on accented endings flags valid words ("más", "inglés", "interés").
 * When a new voseo form slips through, add it here and to specs/012-pulido-onboarding/contracts/ui-copy.md.
 */
const VOSEO_FORMS = [
  // present tense / vos
  'querés', 'podés', 'tenés', 'sabés', 'hacés', 'debés', 'necesitás', 'ganás', 'aceptás', 'sos', 'vos',
  // imperatives
  'elegí', 'seleccioná', 'ingresá', 'completá', 'escribí', 'definí', 'agregá', 'eliminá', 'renombrá',
  'guardá', 'registrá', 'creá', 'organizá', 'usá', 'descargá', 'intentá', 'buscá', 'modificá', 'añadí',
  'compartí', 'ajustá', 'asigná', 'editá', 'gestioná', 'hacé', 'mirá', 'pasá', 'volvé', 'probá', 'revisá',
  'confirmá', 'cargá', 'vinculá', 'cerrá', 'tocá', 'pulsá', 'presioná', 'cancelá', 'activá', 'desactivá',
  'copiá', 'invitá', 'marcá', 'mandá', 'enviá', 'dejá', 'vení', 'tené', 'andá', 'poné',
  // imperatives with clitics, reflexives and other informal forms
  'unite', 'asegurate', 'fijate', 'acordate', 'decime', 'contame', 'avisame',
  'archivala', 'archivalo', 'agregala', 'agregalas', 'agregalo', 'agregalos', 'escribilo', 'escribila',
  'eliminalo', 'eliminala', 'guardalo', 'guardala', 'crealo', 'creala', 'copialo', 'copiala', 'usalo', 'usala',
];

// \b is not Unicode aware ("é" is not a word character), so use letter lookarounds instead.
const VOSEO = new RegExp(`(?<!\\p{L})(?:${VOSEO_FORMS.join('|')})(?!\\p{L})`, 'giu');

// Tests sometimes hide voseo behind accent-tolerant regexes (e.g. /no ten[eé]s deudas/). Catch the stem + class.
const VOSEO_IN_CHAR_CLASS = /(?:ten|quer|pod|deb|sab|hac)\[eé\]s|(?:eleg|escrib|defin)\[ií\]|(?:necesit|ingres|seleccion|agreg|elimin|renombr|guard|registr|cre|organiz|us|descarg|intent|busc|modific|asign|edit|ajust|gestion|compart)\[aá\]/giu;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('voseo guard (constitution v2.1.0, Principle VI)', () => {
  it('finds no voseo in any source or test file under src/', () => {
    const hits: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      if (file.endsWith('voseoGuard.test.ts')) continue; // this file lists the forbidden forms
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        for (const form of [...(line.match(VOSEO) ?? []), ...(line.match(VOSEO_IN_CHAR_CLASS) ?? [])]) hits.push(`${file.slice(process.cwd().length + 1)}:${index + 1} -> ${form}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('flags representative voseo forms, accented or not, in any case', () => {
    for (const text of ['Ya querés ver', 'Seleccioná una cuenta', 'Vos le debés', 'archivala', 'Agregalas desde Ajustes', 'unite a uno']) {
      expect(text.match(VOSEO), text).not.toBeNull();
    }
  });

  it('flags voseo hidden behind accent-tolerant regex classes', () => {
    for (const text of ['/no ten[eé]s deudas/i', '/eleg[ií].*categor/i', '/seleccion[aá] una/i']) {
      expect(text.match(VOSEO_IN_CHAR_CLASS), text).not.toBeNull();
    }
    for (const text of ['/sin categor[ií]a/i', '/h[aá]bitos/i', '/ingl[eé]s/i']) {
      expect(text.match(VOSEO_IN_CHAR_CLASS), text).toBeNull();
    }
  });

  it('does not flag valid neutral Spanish', () => {
    for (const text of ['más', 'Más', 'inglés', 'Interés', 'Superaste', 'Define en qué categorías quieres', 'Tú le debes a ana', 'archívala', 'Agrégalas', 'revisar', 'creación']) {
      expect(text.match(VOSEO), text).toBeNull();
    }
  });
});
