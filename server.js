// ── HOSPERTZ WHATSAPP AI AGENT – PRIYA ──────────────────────────────────────
// Stack: Node.js + Express + Google Gemini + Interakt WhatsApp API
// Deploy free on: railway.app
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const app = express();
app.use(express.json());

const CONFIG = {
  GEMINI_API_KEY:   process.env.GEMINI_API_KEY   || '',
  INTERAKT_API_KEY: process.env.INTERAKT_API_KEY  || 'WmYyYld6ZjB0MEZEVnBxR1U1ODRUbU56ZTlsQmhQYVFBNGsxTmhZYk1mbzo=',
  ALERT_PHONE:      process.env.ALERT_PHONE       || '918369333635',
  BUSINESS_PHONE:   process.env.BUSINESS_PHONE    || '918655963914',
  PORT:             process.env.PORT              || 3000
};

const conversations = {};
const leadProfiles  = {};

function buildSystemPrompt(phone) {
  const p     = leadProfiles[phone] || {};
  const isNew = !conversations[phone] || conversations[phone].length === 0;
  return `You are Priya, a warm and professional sales representative from Hospertz India Pvt. Ltd.

ABOUT HOSPERTZ:
- Turnkey hospital design, construction & interior execution across India
- Services: Greenfield hospital builds, hospital renovation, OT/ICU/NICU setup, modular operation theatres, hospital interiors, space planning, NABH-compliant design
- 100+ completed hospital projects pan-India
- Based in Mumbai. Founder: Dr. Vishal Jadhav

YOUR PERSONA:
- Name: Priya from Hospertz
- Warm, helpful, professional
- Write in simple English, short sentences, WhatsApp style
- Use occasional emojis but don't overdo it
- Keep each reply under 80 words

${isNew ? 'FIRST MESSAGE: Introduce yourself warmly and ask ONE question to understand their project.' : `ONGOING CONVERSATION. Qualify the lead. Known info: ${JSON.stringify(p)}`}

RULES:
- Never make up prices or timelines
- Always stay in character as Priya`;
}

async function callGemini(phone, userMessage) {
  if (!CONFIG.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  if (!conversations[phone]) conversations[phone] = [];
  conversations[phone].push({ role: 'user', content: userMessage });
  const contents = conversations[phone].map(msg => ({
    role:  msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt(phone) }] },
    contents,
    generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.text(); throw new Error(`Gemini ${res.status}: ${err}`); }
  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hi! I'm Priya from Hospertz. How can I help? 😊";
  conversations[phone].push({ role: 'assistant', content: reply });
  if (conversations[phone].length > 20) conversations[phone] = conversations[phone].slice(-20);
  return reply;
}

async function sendWhatsAppMessage(phone, message) {
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${CONFIG.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode: '+91', phoneNumber: phone.replace(/^91/, ''), callbackData: 'priya_reply', type: 'Text', data: { message } })
  });
  const data = await res.json();
  console.log('Interakt send result:', JSON.stringify(data));
  return data;
}

app.post('/api/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('Webhook received:', JSON.stringify(body));
    const customer = body?.data?.customer;
    const message  = body?.data?.message;
    if (!customer || !message) return res.status(200).json({ status: 'ignored', reason: 'no customer or message' });
    const chatType = message?.chat_message_type;
    if (chatType !== 'CustomerMessage') return res.status(200).json({ status: 'ignored', reason: 'not a customer message', chatType });
    const phone = customer?.phone_number || customer?.id;
    const text  = message?.message || '';
    const name  = customer?.traits?.name || '';
    if (!phone || !text) return res.status(200).json({ status: 'ignored', reason: 'no phone or text' });
    console.log(`Message from ${phone}: ${text}`);
    if (!leadProfiles[phone]) leadProfiles[phone] = {};
    if (name) leadProfiles[phone].name = name;
    res.status(200).json({ status: 'processing' });
    try {
      const reply = await callGemini(phone, text);
      console.log(`Priya reply to ${phone}: ${reply}`);
      const sendResult = await sendWhatsAppMessage(phone, reply);
      console.log('Send result:', JSON.stringify(sendResult));
    } catch (aiErr) {
      console.error('AI/Send error:', aiErr.message);
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    res.status(200).json({ status: 'error', message: err.message });
  }
});

app.get('/test', async (req, res) => {
  const result = { gemini: null, interakt: null, errors: [] };
  try {
    const reply = await callGemini('test_debug_' + Date.now(), 'Hello, I want to set up a hospital');
    result.gemini = { ok: true, reply };
  } catch (e) {
    result.gemini = { ok: false, error: e.message };
    result.errors.push('Gemini: ' + e.message);
  }
  if (result.gemini?.ok) {
    try {
      const phone = CONFIG.ALERT_PHONE.replace(/^91/, '');
      const sendRes = await sendWhatsAppMessage(phone, 'Test from Priya: ' + result.gemini.reply.slice(0, 80));
      result.interakt = { ok: true, response: sendRes };
    } catch (e) {
      result.interakt = { ok: false, error: e.message };
      result.errors.push('Interakt: ' + e.message);
    }
  }
  res.json(result);
});

app.get('/', (req, res) => {
  res.json({ status: 'Priya is live', ai: 'Gemini 1.5 Flash', webhook: '/api/webhook', test: '/test', timestamp: new Date().toISOString() });
});

app.listen(CONFIG.PORT, () => {
  console.log(`Priya running on port ${CONFIG.PORT}, Gemini key set: ${!!CONFIG.GEMINI_API_KEY}`);
});
