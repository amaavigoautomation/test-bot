'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/chat');
const { validateUrl, safeEqual } = handler._test;

test('accepts the tenant chatbot webhook route on the approved host', () => {
  const url = validateUrl('https://leads.amaavigo.com/api/webhooks/chatbot/tenant_123');
  assert.equal(url.host, 'leads.amaavigo.com');
});
test('rejects non-HTTPS and non-chatbot routes', () => {
  assert.throws(() => validateUrl('http://leads.amaavigo.com/api/webhooks/chatbot/id'), /HTTPS/);
  assert.throws(() => validateUrl('https://leads.amaavigo.com/api/webhooks/website/id'), /Expected/);
});
test('rejects unapproved hosts', () => {
  assert.throws(() => validateUrl('https://example.com/api/webhooks/chatbot/id'), /allowlist/);
});
test('compares tester passwords without accepting empty values', () => {
  assert.equal(safeEqual('secret-value', 'secret-value'), true);
  assert.equal(safeEqual('wrong', 'secret-value'), false);
  assert.equal(safeEqual('', ''), false);
});
