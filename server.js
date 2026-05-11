// ── HOSPERTZ WHATSAPP AI AGENT – DHWANI ──────────────────────────────────────
// Stack: Node.js + Express + Groq (Llama 3.1) + Interakt WhatsApp API
// Deploy free on: railway.app
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const app = express();
app.use(express.json());

const CONFIG = {
  GROQ_API_KEY:      process.env.GROQ_API_KEY      || '',
  INTERAKT_API_KEY:  process.env.INTERAKT_API_KEY  || 'WmYyYld6ZjB0MEZEVnBxR1U1ODRUbU56ZTlsQmhQYVFBNGsxTmhZYk1mbzo=',
  ALERT_PHONE:       process.env.ALERT_PHONE       || '918369333635',
  BUSINESS_PHONE:    process.env.BUSINESS_PHONE    || '918655963914',
  MEET_LINK:         process.env.MEET_LINK         || 'https://calendly.com/automate-hospertz/30min',
  PORT:              process.env.PORT              || 3000
};

// ── IN-MEMORY STORES ───────────────────────────────────────────────────────────
const conversations = {}; // { phone: [{ role, content }] }
const leadProfiles  = {}; // { phone: { name, email, projectType, city, budget } }

// ── HOSPERTZ PORTFOLIO & PAST PROJECTS ────────────────────────────────────────
const HOSPERTZ_PORTFOLIO = `
HOSPERTZ COMPLETED PROJECTS (share 1-2 when relevant):
1. Kohinoor Hospital, Kurla, Mumbai – 150-bed multi-speciality, full turnkey
2. Ruby Hall Clinic Expansion, Pune – ICU & OT renovation, NABH compliance
3. Global Hospital, Mumbai – Greenfield 200-bed hospital design & construction
4. Navgati Hospital, Nashik – Modular OT complex with 4 operation theatres
5. Sunshine Maternity & NICU, Thane – Complete NICU/PICU design & fit-out
6. LifeCare Diagnostics, Navi Mumbai – Radiology & diagnostic centre interior
7. MedCure Hospital, Aurangabad – 80-bed hospital renovation + OPD redesign
8. City Ortho & Spine, Pune – Speciality orthopaedic greenfield hospital build
9. Horizon Multispeciality, Nagpur – 120-bed hospital with modular theatres
10. Samarth Hospital, Kolhapur – Full hospital interior + NABH documentation

SERVICES: Greenfield hospital construction | Renovation & expansion | OT/ICU/NICU/PICU setup |
Modular OTs | Hospital interiors | Space planning | NABH compliance | Medical gas pipeline | Equipment coordination

KEY FACTS: 100+ projects pan-India | Maharashtra, Karnataka, Rajasthan, MP, UP & more |
Mumbai-based | Founder: Dr. Vishal Jadhav
`;

// ── BRAND INTRO (sent as first outbound message) ──────────────────────────────
const BRAND_INTRO = `Hello! 👋 This is Team *HOSPERTZ INDIA PVT LTD* 🏥

We are a healthcare infrastructure and hospital development company working on modern healthcare projects across India.

🌐 www.hospertz.com

We specialise in:
✅ Hospital Planning & Designing
✅ Turnkey Hospital Setup
✅ NABH & JCI Compliant Infrastructure
✅ Operation Theatre & ICU Planning
✅ Medical Equipment Planning & Procurement
✅ Hospital Interiors & Execution
✅ Infection Control & Healthcare Engineering
✅ End-to-End Project Management for Clinics, Hospitals & Medical Colleges

From concept to commissioning...

Warm regards,
*HOSPERTZ INDIA PVT LTD* | www.hospertz.com`;

// ── SYSTEM PROMPT BUILDER ─────────────────────────────────────────────────────
function buildSystemPrompt(phone) {
  const p       = leadProfiles[phone] || {};
  const isNew   = !conversations[phone] || conversations[phone].length === 0;
  const known   = Object.keys(p).length > 0 ? JSON.stringify(p) : 'nothing yet';
  const missing = [
    !p.name        && 'name',
    !p.email       && 'email address',
    !p.projectType && 'project type (new hospital / renovation / OT / ICU)',
    !p.city        && 'city/location',
    !p.budget      && 'budget or bed count',
  ].filter(Boolean);

  const hasEnoughForMeeting = p.name && p.email && p.projectType;

  return `You are Dhwani, a warm and professional sales representative from Hospertz India Pvt. Ltd.

${HOSPERTZ_PORTFOLIO}

FOUNDER: Dr. Vishal Jadhav – 15+ years expertise, 100+ hospital projects across India.

YOUR PERSONA:
- Warm, friendly, helpful — like a knowledgeable colleague
- Write in simple English, short sentences, WhatsApp style
- Use occasional emojis (😊 📅 🏥) but keep it professional
- Keep each reply under 90 words — never write long paragraphs

CONVERSATION FLOW:
Step 1: Understand their project (type, location, scale)
Step 2: Build trust — mention 1-2 relevant past projects + Dr. Vishal Jadhav
Step 3: Collect NAME (ask naturally)
Step 4: Collect EMAIL — "Could I get your email so our architect can share a detailed proposal?"
Step 5: Once you have name + email + project type → push for a FREE meeting:
"I'd love to connect you with Dr. Vishal Jadhav for a FREE 30-min requirements call. Here's the link 📅 👉 ${CONFIG.MEET_LINK}
No obligations — just a quick call to understand your vision. Shall I confirm your slot?"

CURRENT LEAD INFO: ${known}
${missing.length > 0 ? `STILL NEED TO COLLECT: ${missing.join(', ')}` : '✅ All key info collected — push for the meeting now.'}
${hasEnoughForMeeting ? '\n⚠️ IMPORTANT: You have enough info. Your NEXT reply MUST share the meeting link above.' : ''}

${isNew ? 'FIRST MESSAGE: Greet warmly as Dhwani from Hospertz. Ask ONE question about their project.' : 'ONGOING: Continue naturally. Ask ONE missing piece at a time.'}

RULES:
- NEVER make up prices or timelines
- ALWAYS stay in character as Dhwani from Hospertz
- If lead books the meeting, say Dr. Jadhav's team will reach out via hospertz@gmail.com
- Keep responses SHORT — this is WhatsApp, not email`;
}

// ── AUTO-EXTRACT LEAD INFO ────────────────────────────────────────────────────
function extractLeadInfo(phone, text, customerName) {
  if (!leadProfiles[phone]) leadProfiles[phone] = {};
  const p = leadProfiles[phone];
  const t = text.toLowerCase();

  if (customerName && !p.name) p.name = customerName;

  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && !p.email) p.email = emailMatch[0];

  if (!p.projectType) {
    if      (t.includes('new hospital') || t.includes('greenfield'))              p.projectType = 'Greenfield new hospital';
    else if (t.includes('renovat') || t.includes('expand'))                       p.projectType = 'Renovation/expansion';
    else if (t.includes('operation theatre') || t.includes('modular ot'))         p.projectType = 'OT setup';
    else if (t.includes('icu') || t.includes('nicu') || t.includes('picu'))      p.projectType = 'ICU/NICU setup';
    else if (t.includes('interior') || t.includes('design'))                      p.projectType = 'Hospital interiors';
  }

  if (!p.city) {
    const cities = ['mumbai','pune','delhi','bangalore','bengaluru','hyderabad','chennai','nagpur','nashik','aurangabad','kolhapur','thane','navi mumbai','ahmedabad','surat','jaipur','lucknow','bhopal','indore'];
    for (const city of cities) {
      if (t.includes(city)) { p.city = city.charAt(0).toUpperCase() + city.slice(1); break; }
    }
  }

  if (t.includes('booked') || t.includes('confirmed') || t.includes('scheduled')) p.meetingBooked = true;
  leadProfiles[phone] = p;
}

// ── CALL GROQ (Llama 3.1 8B Instant) WITH RETRY ──────────────────────────────
async function callGroq(phone, userMessage, retryCount = 0) {
  if (!CONFIG.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

  if (!conversations[phone]) conversations[phone] = [];
  if (retryCount === 0) conversations[phone].push({ role: 'user', content: userMessage });

  const rawHistory   = conversations[phone].slice(-20);
  const firstUserIdx = rawHistory.findIndex(m => m.role === 'user');
  const history      = firstUserIdx > 0 ? rawHistory.slice(firstUserIdx) : rawHistory;

  const messages = [{ role: 'system', content: buildSystemPrompt(phone) }];
  let lastRole = 'system';
  for (const msg of history) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    if (role === lastRole) continue;
    messages.push({ role, content: msg.content });
    lastRole = role;
  }
  if (messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: userMessage });
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}` },
    body:    JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 300, messages }),
    signal:  AbortSignal.timeout(25000)
  });

  if (!res.ok) {
    const err = await res.text();
    if (retryCount < 2 && (res.status >= 500 || res.status === 429)) {
      const delay = retryCount === 0 ? 3000 : 8000;
      console.log(`Groq ${res.status} – retry ${retryCount + 1} in ${delay/1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      return callGroq(phone, userMessage, retryCount + 1);
    }
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data  = await res.json();
  const reply = data.choices?.[0]?.message?.content || "Hi! I'm Dhwani from Hospertz. How can I help? 😊";

  conversations[phone].push({ role: 'assistant', content: reply });
  if (conversations[phone].length > 30) {
    conversations[phone] = conversations[phone].slice(-30);
    const fu = conversations[phone].findIndex(m => m.role === 'user');
    if (fu > 0) conversations[phone] = conversations[phone].slice(fu);
  }
  return reply;
}

// ── SEND WHATSAPP MESSAGE VIA INTERAKT ───────────────────────────────────────
async function sendWhatsAppMessage(phone, message) {
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${CONFIG.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ countryCode: '+91', phoneNumber: phone.replace(/^91/, ''), callbackData: 'dhwani_reply', type: 'Text', data: { message } })
  });
  const data = await res.json();
  console.log('Interakt send result:', JSON.stringify(data));
  return data;
}

// ── FUNNEL 1 — INBOUND WEBHOOK ────────────────────────────────────────────────
app.post('/api/webhook', async (req, res) => {
  try {
    const body     = req.body;
    const customer = body?.data?.customer;
    const message  = body?.data?.message;
    if (!customer || !message) return res.status(200).json({ status: 'ignored', reason: 'no customer or message' });

    const chatType = message?.chat_message_type;
    if (chatType !== 'CustomerMessage') return res.status(200).json({ status: 'ignored', reason: 'not a customer message' });

    const phone = customer?.phone_number || customer?.id;
    const text  = message?.message || '';
    const name  = customer?.traits?.name || '';
    if (!phone || !text) return res.status(200).json({ status: 'ignored', reason: 'no phone or text' });

    console.log(`[INBOUND] ${phone}: ${text}`);
    extractLeadInfo(phone, text, name);
    res.status(200).json({ status: 'processing' });

    try {
      const reply = await callGroq(phone, text);
      console.log(`[DHWANI → ${phone}]: ${reply}`);
      await sendWhatsAppMessage(phone, reply);
    } catch (aiErr) {
      console.error('AI/Send error:', aiErr.message);
      try { await sendWhatsAppMessage(phone, "Hi! I'm Dhwani from Hospertz 😊 Brief technical issue — please resend your message!"); }
      catch (fbErr) { console.error('Fallback failed:', fbErr.message); }
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).json({ status: 'error', message: err.message });
  }
});

// ── FUNNEL 2 — OUTBOUND FIRST MESSAGE ────────────────────────────────────────
app.post('/send-first-message', async (req, res) => {
  try {
    const { name, phone, projectHint } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const cleanPhone = phone.toString().replace(/^(\+91|91)/, '').replace(/\D/g, '');
    const fullPhone  = '91' + cleanPhone;

    if (!leadProfiles[fullPhone]) leadProfiles[fullPhone] = {};
    if (name)        leadProfiles[fullPhone].name        = name;
    if (projectHint) leadProfiles[fullPhone].projectHint = projectHint;

    await sendWhatsAppMessage(cleanPhone, BRAND_INTRO);
    await new Promise(r => setTimeout(r, 1500));

    const prompt = `You are starting an outbound WhatsApp conversation with ${name || 'a doctor/hospital admin'}.${projectHint ? ` Context: ${projectHint}.` : ''} Write a warm, short follow-up (under 50 words) as Dhwani from Hospertz. Ask ONE question about their project.`;
    const followUp = await callGroq(fullPhone, prompt);
    await sendWhatsAppMessage(cleanPhone, followUp);

    console.log(`[OUTBOUND → ${cleanPhone}]: "${followUp}"`);
    res.json({ status: 'sent', phone: cleanPhone, name, intro: 'sent', followUp });
  } catch (err) {
    console.error('Outbound error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
app.get('/leads', (req, res) => {
  const leads = Object.entries(leadProfiles).map(([phone, profile]) => ({
    phone, ...profile,
    messages:    conversations[phone]?.length || 0,
    lastMessage: conversations[phone]?.slice(-1)?.[0]?.content?.slice(0, 100) || ''
  }));
  res.json({ total: leads.length, leads });
});

app.get('/test', async (req, res) => {
  const result = { groq: null, interakt: null, errors: [], meetLink: CONFIG.MEET_LINK };
  try {
    const reply = await callGroq('test_' + Date.now(), 'Hello, I want to set up a 100-bed hospital in Pune');
    result.groq = { ok: true, reply };
  } catch (e) { result.groq = { ok: false, error: e.message }; result.errors.push('Groq: ' + e.message); }

  if (result.groq?.ok) {
    try {
      const sendRes = await sendWhatsAppMessage(CONFIG.ALERT_PHONE.replace(/^91/, ''), 'Test: ' + result.groq.reply.slice(0, 80));
      result.interakt = { ok: true, response: sendRes };
    } catch (e) { result.interakt = { ok: false, error: e.message }; result.errors.push('Interakt: ' + e.message); }
  }
  res.json(result);
});

app.get('/', (req, res) => {
  res.json({
    status:   'Dhwani is live ✅',
    ai:       'Groq Llama 3.1 8B Instant (free – 14,400 req/day)',
    meetLink: CONFIG.MEET_LINK,
    endpoints: { test: 'GET /test', leads: 'GET /leads', outbound: 'POST /send-first-message' },
    timestamp: new Date().toISOString()
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`Dhwani on port ${CONFIG.PORT} | Groq: ${!!CONFIG.GROQ_API_KEY} | Meet: ${CONFIG.MEET_LINK}`);
});
