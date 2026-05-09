// ── HOSPERTZ WHATSAPP AI AGENT – DHWANI ──────────────────────────────────────
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
  MEET_LINK:        process.env.MEET_LINK         || 'https://calendly.com/automate-hospertz/30min',
  PORT:             process.env.PORT              || 3000
};

// ── IN-MEMORY STORES ─────────────────────────────────────────────────────────
const conversations = {}; // { phone: [{ role, content }] }
const leadProfiles  = {}; // { phone: { name, email, projectType, city, budget } }

// ── HOSPERTZ PORTFOLIO & PAST PROJECTS ───────────────────────────────────────
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

SERVICES: Greenfield hospital construction | Renovation & expansion | OT/ICU/NICU/PICU setup | Modular OTs | Hospital interiors | Space planning | NABH compliance | Medical gas pipeline | Equipment coordination

KEY FACTS: 100+ projects pan-India | Maharashtra, Karnataka, Rajasthan, MP, UP & more | Mumbai-based | Founder: Dr. Vishal Jadhav
`;

// ── BRAND INTRO (sent as first outbound message) ──────────────────────────────
const BRAND_INTRO = `Hello! 👋
This is Team *HOSPERTZ INDIA PVT LTD* 🏥

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

// ── SYSTEM PROMPT BUILDER ────────────────────────────────────────────────────
function buildSystemPrompt(phone) {
  const p     = leadProfiles[phone] || {};
  const isNew = !conversations[phone] || conversations[phone].length === 0;
  const known = Object.keys(p).length > 0 ? JSON.stringify(p) : 'nothing yet';

  const missing = [
    !p.name        && 'name',
    !p.email       && 'email address',
    !p.projectType && 'project type (new hospital / renovation / OT / ICU)',
    !p.city        && 'city/location',
    !p.budget      && 'budget or bed count',
  ].filter(Boolean);

  const hasEnoughForMeeting = p.name && p.email && p.projectType;

  return `You are Dhwani, a warm and professional sales representative from Hospertz India Pvt. Ltd. – India's leading hospital design, construction & turnkey project company.

${HOSPERTZ_PORTFOLIO}

FOUNDER: Dr. Vishal Jadhav – 15+ years expertise, 100+ hospital projects across India. Mention him naturally when building trust.

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
  "I'd love to connect you with Dr. Vishal Jadhav for a FREE 30-min requirements call. Here's the link 📅
  👉 ${CONFIG.MEET_LINK}
  No obligations — just a quick call to understand your vision. Shall I confirm your slot?"

CURRENT LEAD INFO: ${known}
${missing.length > 0 ? `STILL NEED TO COLLECT: ${missing.join(', ')}` : '✅ All key info collected — push for the meeting now.'}
${hasEnoughForMeeting ? '\n⚠️ IMPORTANT: You have enough info. Your NEXT reply MUST share the meeting link above.' : ''}

${isNew ? 'FIRST MESSAGE: Greet warmly as Dhwani from Hospertz. Ask ONE question about their project.' : 'ONGOING: Continue naturally. Ask ONE missing piece at a time. Never dump multiple questions.'}

RULES:
- NEVER make up prices or timelines — "Our architect will give you an accurate estimate on the call"
- ALWAYS stay in character as Dhwani from Hospertz
- If lead books the meeting, confirm warmly — say Dr. Jadhav's team will reach out via hospertz@gmail.com
- Keep responses SHORT — this is WhatsApp, not email`;
}

// ── AUTO-EXTRACT LEAD INFO FROM MESSAGES ─────────────────────────────────────
function extractLeadInfo(phone, text, customerName) {
  if (!leadProfiles[phone]) leadProfiles[phone] = {};
  const p = leadProfiles[phone];
  const t = text.toLowerCase();

  if (customerName && !p.name) p.name = customerName;

  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && !p.email) p.email = emailMatch[0];

  if (!p.projectType) {
    if      (t.includes('new hospital') || t.includes('greenfield') || t.includes('build a hospital')) p.projectType = 'Greenfield new hospital';
    else if (t.includes('renovat') || t.includes('expand') || t.includes('upgrade'))                   p.projectType = 'Renovation/expansion';
    else if (t.includes('operation theatre') || t.includes('ot setup') || t.includes('modular ot'))    p.projectType = 'OT setup';
    else if (t.includes('icu') || t.includes('nicu') || t.includes('picu'))                            p.projectType = 'ICU/NICU setup';
    else if (t.includes('interior') || t.includes('design') || t.includes('fit out'))                  p.projectType = 'Hospital interiors';
  }

  if (!p.city) {
    const cities = ['mumbai','pune','delhi','bangalore','bengaluru','hyderabad','chennai','nagpur','nashik','aurangabad','kolhapur','thane','navi mumbai','ahmedabad','surat','jaipur','lucknow','bhopal','indore'];
    for (const city of cities) {
      if (t.includes(city)) { p.city = city.charAt(0).toUpperCase() + city.slice(1); break; }
    }
  }

  if (t.includes('booked') || t.includes('confirmed') || t.includes('scheduled')) {
    p.meetingBooked = true;
  }

  leadProfiles[phone] = p;
}

// ── CALL GEMINI (with retry) ──────────────────────────────────────────────────
async function callGemini(phone, userMessage, retryCount = 0) {
  if (!CONFIG.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  if (!conversations[phone]) conversations[phone] = [];

  // Only push user message on first attempt (not retries)
  if (retryCount === 0) {
    conversations[phone].push({ role: 'user', content: userMessage });
  }

  // Take last 20 messages, then find the first user message so we never
  // hand Gemini a history that starts with a model/assistant turn.
  // (Bug: slice(-14) after 7 exchanges cuts off the leading user msg → Gemini 400)
  const rawHistory = conversations[phone].slice(-20);
  const firstUserIdx = rawHistory.findIndex(m => m.role === 'user');
  const history = firstUserIdx > 0 ? rawHistory.slice(firstUserIdx) : rawHistory;

  // Build contents with strict alternation (Gemini: user, model, user, model…)
  const contents = [];
  let lastRole = null;
  for (const msg of history) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (role === lastRole) continue; // skip consecutive same-role messages
    contents.push({ role, parts: [{ text: msg.content }] });
    lastRole = role;
  }

  // Safety: must start with user
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: userMessage }] });
  }

  // Safety: must end with user
  if (contents[contents.length - 1].role !== 'user') {
    contents.push({ role: 'user', parts: [{ text: userMessage }] });
  }

  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt(phone) }] },
    contents,
    generationConfig: { temperature: 0.75, maxOutputTokens: 300 }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000) // 25s timeout
  });

  if (!res.ok) {
    const err = await res.text();
    // Retry once on 5xx or rate limit errors
    if (retryCount < 2 && (res.status >= 500 || res.status === 429)) {
      console.log(`Gemini ${res.status} – retrying in 3s...`);
      await new Promise(r => setTimeout(r, retryCount === 0 ? 8000 : 15000));
      return callGemini(phone, userMessage, retryCount + 1);
    }
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data  = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
    || "Hi! I'm Dhwani from Hospertz. How can I help with your hospital project? 😊";

  conversations[phone].push({ role: 'assistant', content: reply });

  // Keep max 30 messages; after trimming, ensure we still start with a user msg
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
    body: JSON.stringify({
      countryCode:  '+91',
      phoneNumber:  phone.replace(/^91/, ''),
      callbackData: 'dhwani_reply',
      type:         'Text',
      data:         { message }
    })
  });
  const data = await res.json();
  console.log('Interakt send result:', JSON.stringify(data));
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// FUNNEL 1 — INBOUND: Customer messages Hospertz WhatsApp → Dhwani auto-replies
// POST /api/webhook
// ────────────────────────────────────────────────────────────────────────────
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

    console.log(`[INBOUND] ${phone}: ${text}`);
    extractLeadInfo(phone, text, name);

    // Respond to Interakt immediately (prevents timeout retries)
    res.status(200).json({ status: 'processing' });

    // Generate and send Dhwani's reply
    try {
      const reply = await callGemini(phone, text);
      console.log(`[DHWANI → ${phone}]: ${reply}`);
      await sendWhatsAppMessage(phone, reply);
    } catch (aiErr) {
      console.error('AI/Send error:', aiErr.message);
      // Send a fallback so the customer isn't left hanging
      try {
        await sendWhatsAppMessage(phone,
          "Hi! I'm Dhwani from Hospertz 😊 I'm experiencing a brief technical issue. Please send your message again and I'll be right with you!");
      } catch (fbErr) {
        console.error('Fallback send failed:', fbErr.message);
      }
    }

  } catch (err) {
    console.error('Webhook handler error:', err.message);
    res.status(200).json({ status: 'error', message: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// FUNNEL 2 — OUTBOUND: Hospertz inputs a lead → Dhwani sends the FIRST message
// POST /send-first-message
// Body: { "name": "Dr. Sharma", "phone": "9876543210", "projectHint": "200-bed hospital in Pune" }
// ────────────────────────────────────────────────────────────────────────────
app.post('/send-first-message', async (req, res) => {
  try {
    const { name, phone, projectHint } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required (10-digit Indian number)' });

    const cleanPhone = phone.toString().replace(/^(\+91|91)/, '').replace(/\D/g, '');
    const fullPhone  = '91' + cleanPhone;

    // Pre-load lead profile
    if (!leadProfiles[fullPhone]) leadProfiles[fullPhone] = {};
    if (name)        leadProfiles[fullPhone].name        = name;
    if (projectHint) leadProfiles[fullPhone].projectHint = projectHint;

    // Step 1: Send the brand intro
    await sendWhatsAppMessage(cleanPhone, BRAND_INTRO);
    await new Promise(r => setTimeout(r, 1500));

    // Step 2: Send warm AI-generated follow-up
    const openingPrompt = `You are starting an outbound WhatsApp conversation with ${name || 'a doctor/hospital admin'}.
${projectHint ? `Context: They may be interested in: ${projectHint}.` : ''}
Write a very warm, short follow-up message (under 50 words) as Dhwani from Hospertz — right after the brand intro was sent.
Ask ONE open question about their hospital project to start the conversation. Don't repeat the services list.`;

    const followUp = await callGemini(fullPhone, openingPrompt);
    await sendWhatsAppMessage(cleanPhone, followUp);

    console.log(`[OUTBOUND → ${cleanPhone}]: Intro + Dhwani follow-up: "${followUp}"`);
    res.json({ status: 'sent', phone: cleanPhone, name, intro: 'sent', followUp });

  } catch (err) {
    console.error('Outbound error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// VIEW ALL LEADS (admin dashboard)
// GET /leads
// ────────────────────────────────────────────────────────────────────────────
app.get('/leads', (req, res) => {
  const leads = Object.entries(leadProfiles).map(([phone, profile]) => ({
    phone,
    ...profile,
    messages: conversations[phone]?.length || 0,
    lastMessage: conversations[phone]?.slice(-1)?.[0]?.content?.slice(0, 100) || ''
  }));
  res.json({ total: leads.length, leads });
});

// ── TEST ENDPOINT ─────────────────────────────────────────────────────────────
app.get('/test', async (req, res) => {
  const result = { gemini: null, interakt: null, errors: [], meetLink: CONFIG.MEET_LINK };
  try {
    const reply = await callGemini('test_debug_' + Date.now(), 'Hello, I want to set up a 100-bed hospital in Pune');
    result.gemini = { ok: true, reply };
  } catch (e) {
    result.gemini = { ok: false, error: e.message };
    result.errors.push('Gemini: ' + e.message);
  }
  if (result.gemini?.ok) {
    try {
      const phone = CONFIG.ALERT_PHONE.replace(/^91/, '');
      const sendRes = await sendWhatsAppMessage(phone, 'Test from Dhwani: ' + result.gemini.reply.slice(0, 80));
      result.interakt = { ok: true, response: sendRes };
    } catch (e) {
      result.interakt = { ok: false, error: e.message };
      result.errors.push('Interakt: ' + e.message);
    }
  }
  res.json(result);
});

// ── HOME / STATUS ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status:    'Dhwani is live ✅',
    ai:        'Gemini 1.5 Flash',
    meetLink:  CONFIG.MEET_LINK,
    funnels: {
      inbound:  'Customer texts Hospertz WA → Dhwani auto-replies  [POST /api/webhook]',
      outbound: 'Input a lead → Dhwani sends first msg             [POST /send-first-message]'
    },
    endpoints: {
      test:    'GET  /test',
      leads:   'GET  /leads',
      outbound:'POST /send-first-message  { name, phone, projectHint }'
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`Dhwani running on port ${CONFIG.PORT} | Gemini key: ${!!CONFIG.GEMINI_API_KEY} | Meet: ${CONFIG.MEET_LINK}`);
});
