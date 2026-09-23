import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

// recharts' <ResponsiveContainer> measures its wrapper via ResizeObserver and
// only renders its chart children once it sees a non-zero width/height —
// jsdom implements neither ResizeObserver nor real layout, so without this
// polyfill every chart-under-test would render an empty container instead of
// its SVG content (spec 004-dashboards-y-analitica).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverMock;

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 400 });
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 });
