import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from './downloadTextFile';

describe('downloadTextFile', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('clicks a temporary anchor with the filename and a blob of the content, then cleans up', async () => {
    vi.useFakeTimers();
    let blob: Blob | undefined;
    const createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:test'; });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(document.body.contains(this)).toBe(true);
    });

    downloadTextFile('ez-life-movimientos-2026-10.csv', 'a;b\n1;2');

    const clicked = click.mock.contexts[0] as HTMLAnchorElement;
    expect(clicked.getAttribute('download')).toBe('ez-life-movimientos-2026-10.csv');
    expect(clicked.getAttribute('href')).toBe('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(blob?.type).toBe('text/csv;charset=utf-8;');
    expect(await blob?.text()).toBe('a;b\n1;2');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('accepts another MIME type', async () => {
    let blob: Blob | undefined;
    Object.assign(URL, { createObjectURL: (b: Blob) => { blob = b; return 'blob:x'; }, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadTextFile('a.txt', 'hola', 'text/plain');
    expect(blob?.type).toBe('text/plain');
  });
});
