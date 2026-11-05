'use strict';
const crypto = require('node:crypto');
const DEFAULT_ORIGIN = 'https://leads.amaavigo.com';
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
function validateUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('Enter the full chatbot webhook URL from Settings → Chatbot Integration.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Webhook URL must be HTTPS and cannot contain credentials, query parameters, or a fragment.');
  if (!/^\/api\/webhooks\/chatbot\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) throw new Error('Expected /api/webhooks/chatbot/{webhookId}.');
  const allowed = String(process.env.UMRAH_ALLOWED_WEBHOOK_ORIGINS || DEFAULT_ORIGIN).split(',').map(x => new URL(x.trim()).origin);
  if (!allowed.includes(url.origin)) throw new Error('Webhook host is not on the configured allowlist.');
  return url;
}
function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : {};
}
function credentials(body) {
  const envUrl = String(process.env.UMRAH_CHATBOT_WEBHOOK_URL || '').trim();
  const envSecret = String(process.env.UMRAH_CHATBOT_API_SECRET || '').trim();
  if (!!envUrl !== !!envSecret) throw new Error('Both server webhook environment variables must be configured together.');
  const fromEnv = !!(envUrl && envSecret);
  const url = fromEnv ? envUrl : body.webhookUrl;
  const secret = fromEnv ? envSecret : String(body.apiSecret || '').trim();
  if (!secret) throw new Error('Chatbot API secret is required.');
  return { url: validateUrl(url), secret, source: fromEnv ? 'Vercel environment' : 'current browser tab' };
}
async function upstream(url, secret, method, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const started = Date.now();
  try {
    const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + secret, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}), redirect: 'manual', signal: controller.signal });
    const raw = await r.text();
    let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { rawText: raw.slice(0, 8000) }; }
    return { upstreamStatus: r.status, upstreamOk: r.ok, durationMs: Date.now() - started, response: data };
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('Webhook timed out after 25 seconds.'), { statusCode: 504 });
    throw Object.assign(new Error('Unable to reach the Umrah webhook.'), { statusCode: 502 });
  } finally { clearTimeout(timer); }
}
module.exports = async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { success: true, accessPasswordConfigured: !!process.env.AI_BOT_ACCESS_PASSWORD, serverCredentialsConfigured: !!(process.env.UMRAH_CHATBOT_WEBHOOK_URL && process.env.UMRAH_CHATBOT_API_SECRET) });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { success: false, error: 'Method not allowed.' }); }
  let body; try { body = bodyOf(req); } catch { return send(res, 400, { success: false, error: 'Invalid JSON request body.' }); }
  const expected = process.env.AI_BOT_ACCESS_PASSWORD || '';
  if (!expected) return send(res, 503, { success: false, error: 'AI_BOT_ACCESS_PASSWORD is not configured in Vercel.' });
  if (!safeEqual(req.headers['x-ai-bot-password'], expected)) return send(res, 401, { success: false, error: 'Incorrect tester access password.' });
  let c; try { c = credentials(body); } catch (e) { return send(res, 400, { success: false, error: e.message }); }
  const action = body.action === 'verify' ? 'verify' : 'message';
  const message = String(body.message || '').trim();
  if (action === 'message' && (!message || message.length > 4000)) return send(res, 400, { success: false, error: 'Enter a message of up to 4,000 characters.' });
  const history = Array.isArray(body.history) ? body.history.slice(-10).map(x => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: String(x.content || '').trim().slice(0, 2000) })).filter(x => x.content) : [];
  const payload = { message, history, ...(body.conversationId ? { conversationId: String(body.conversationId).slice(0, 128) } : {}), visitor: { name: 'Test Bot', company: 'Amaavigo QA' } };
  try {
    const result = await upstream(c.url.toString(), c.secret, action === 'verify' ? 'GET' : 'POST', action === 'verify' ? undefined : payload);
    return send(res, 200, { success: result.upstreamOk && (action === 'verify' ? result.response.success === true : result.response.success !== false), action, credentialSource: c.source, request: { method: action === 'verify' ? 'GET' : 'POST', path: c.url.pathname, historyCount: history.length }, ...result });
  } catch (e) { return send(res, e.statusCode || 502, { success: false, action, error: e.message }); }
};
module.exports._test = { validateUrl, safeEqual };
