import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDashboard } from './dashboard.js';

describe('Dashboard module boundary', () => {
  it('imports without accessing the browser DOM and exposes its initializer', () => {
    const dashboard = createDashboard({ state: {} });
    assert.equal(typeof dashboard.initDashboardPage, 'function');
  });
});
