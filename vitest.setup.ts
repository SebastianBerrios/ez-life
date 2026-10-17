import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// The suite creates one jsdom per file and runs files in parallel; under that
// load the 1s default of findBy*/waitFor made otherwise-correct async tests
// time out intermittently. A longer ceiling costs nothing when they pass.
configure({ asyncUtilTimeout: 4000 });

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
