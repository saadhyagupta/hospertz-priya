// HOSPERTZ WHATSAPP AI AGENT - PRIYA
// Stack: Node.js + Express + Google Gemini + Interakt WhatsApp API
// Deploy free on: railway.app

const express = require('express');
const app = express();
app.use(express.json());

const CONFIG = {
  GEMINI_API_KEY:   process.env.GEMINI_API_KEY   || '',
  INTERAKT_API_KEY: process.env.INTERAKT_API_KEY  || 'WmYyYld6ZjB0MEZEVnBxR1U1ODRUbU56ZTlsQmhQYVFBNGsxTmhZYk1mbzo=',
  ALERT_PHONE:      process.env.ALERT_PHONE       || '918369333635',
  BUSINESS_PHONE:   process.env.BUSINESS_PHONE    || '918655963914',
  MEET_LINK:        process.env.MEET_LINK         || 'https://calendly.com/hospertz',
  PORT:             process.env.PORT              || 3000
};

const conversations = {};
const leadProfiles  = {};

const HOSPERTZ_PORTFOLIO = `
HOSPERTZ COMPLETED PROJECTS (use these as examples when relevant):
1. Kohinoor Hospital, Kurla, Mumbai - 150-bed multi-speciality, full turnkey execution
2. Ruby Hall Clinic Expansion, Pune - ICU & OT block renovation, NABH compliance
3. Global Hospital, Mumbai - Greenfield 200-bed hospital design & construction
4. Navgati Hospital, Nashik - Modular OT complex with 4 operation theatres
5. Sunshine Maternity & NICU, Thane - Complete NICU/PICU design & fit-out
6. LifeCare Diagnostics, Navi Mumbai - Radiology & diagnostic centre interior
7. MedCure Hospital, Aurangabad - 80-bed hospital renovation + OPD redesign
8. City Ortho & Spine, Pune - Speciality orthopaedic greenfield hospital build
9. Horizon Multispeciality, Nagpur - 120-bed hospital with modular theatres
10. Samarth Hospital, Kolhapur - Full hospital interior + NABH documentation support

SERVICES HOSPERTZ OFFERS:
- Greenfield hospital construction (new builds)
- Hospital renovation & expansion
- OT / ICU / NICU / PICU setup & fit-out
- Modular operation theatres
- Hospital interiors (IPD rooms, OPD, reception, corridors)
- Space planning & architectural drawings
- NABH compliance design & documentation
- Medical gas pipeline systems
- Hospital furniture & equipment coordination

KEY FACTS:
- 100+ completed hospital projects pan-India
- Delivered across Maharashtra, Karnataka, Rajasthan, MP, UP & more
- Based in Mumbai | Founder: Dr. Vishal Jadhav | hospertz@gmail.com
`;

function buildSystemPrompt(phone) {
  const p      = leadProfiles[phone] || {};
  const isNew  = !conversations[phone] || conversations[phone].length === 0;
  const known  = Object.keys(p).length > 0 ? JSON.stringify(p) : 'nothing yet';

  const missing = [
    !p.name        && 'name',
    !p.email       && 'email address',
    !p.projectType && 'project type',
    !p.city        && 'city/location',
    !p.budget      && 'budget or bed count',
  ].filter(Boolean);

  const hasEnoughForMeeting = p.name && p.email && p.projectType;

  return `You are Priya, a warm and professional sales representative from Hospertz India Pvt. Ltd.

${HOSPERTZ_PORTFOLIO}

YOUR PERSONA:
- Name: Priya from Hospertz
- Warm, friendly, helpful like a knowledgeable colleague
- Write in simple English, short sentences, WhatsApp style
- Use occasional emojis but do not overdo it
- Keep each reply under 90 words

CONVERSATION GOAL - QUALIFY THE LEAD, THEN BOOK A MEETING:
Step 1: Collect their NAME
Step 2: Collect their EMAIL - say: "Could I get your email so our architect can share a detailed proposal?"
Step 3: Understand PROJECT TYPE (new hospital / renovation / OT setup / ICU / interiors)
Step 4: Ask about CITY / LOCATION
Step 5: Ask about SCALE (bed count or rough budget)
Step 6: PUSH TOWARDS MEETING - once you have name + email + project type, share the meeting link

CURRENT LEAD INFO: ${known}
${missing.length > 0 ? 'STILL NEED TO ASK: ' + missing.join(', ') : 'All key info collected.'}

${hasEnoughForMeeting
  ? 'IMPORTANT: You now have enough info. In your NEXT reply push towards a meeting. Say: I would love to connect you with our senior architect for a FREE 30-min requirements call. Here is the link to pick a slot: ' + CONFIG.MEET_LINK + ' - This call is completely free, no obligations!'
  : ''}

${isNew
  ? 'FIRST MESSAGE: Greet warmly as Priya from Hospertz. Ask ONE opening question about their project.'
  : 'ONGOING: Continue naturally. Ask the next missing piece ONE at a time.'}

RULES:
- Never make up prices or timelines
- Say our architect will give an accurate estimate on the call for cost questions
- Always stay in character as Priya
- Mention Hospertz portfolio examples when relevant
- If the lead books the meeting confirm warmly and say the architect will reach out via hospertz@gmail.com`;
}

function extractLeadInfo(phone, text, customerName) {
  if (!leadProfiles[phone]) leadProfiles[phone] = {};
  const p = leadProfiles[phone];
  const t = text.toLowerCase();
  if (customerName && !p.name) p.name = customerName;
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && !p.email) p.email = emailMatch[0];
  if (!p.projectType) {
    if      (t.includes('new hospital') || t.includes('greenfield')) p.projectType = 'Greenfield new hospital';
    else if (t.includes('renovat') || t.includes('expand'))          p.projectType = 'Renovation/expansion';
    else if (t.includes('ot setup') || t.includes('operation theatre')) p.projectType = 'OT setup';
    else if (t.includes('icu') || t.includes('nicu'))                p.projectType = 'ICU/NICU setup';
    else if (t.includes('interior') || t.includes('design'))         p.projectType = 'Hospital interiors';
  }
  if (t.includes('booked') || t.includes('confirmed')) p.meetingBooked = true;
  leadProfiles[phone] = p;
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
    generationConfig: { temperature: 0.8, maxOutputTokens: 350 }
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.text(); throw new Error(`Gemini ${res.status}: ${err}`); }
  const data  = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hi! I am Priya from Hospertz. How can I help?";
  conversations[phone].push({ role: 'assistant', content: reply });
  if (conversations[phone].length > 20) conversations[phone] = conversations[phone].slice(-20);
  return reply;
}

async function sendWhatsAppMessage(phone, message) {
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${CONFIG.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode: '+91', phoneNumber: phone.replace(/^91/, ''), callbackData: 'priya_reply', type: 'Text', data: { message } })
  });
  const data = await res.json();
  console.log('Interakt send result:', JSON.stringify(data));
  return data;
}

// FUNNEL 1 - INBOUND: Customer messages Hospertz WhatsApp -> Priya auto-replies
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
    res.status(200).json({ status: 'processing' });
    try {
      const reply = await callGemini(phone, text);
      console.log(`[PRIYA -> ${phone}]: ${reply}`);
      await sendWhatsAppMessage(phone, reply);
    } catch (aiErr) {
      console.error('AI/Send error:', aiErr.message);
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    res.status(200).json({ status: 'error', message: err.message });
  }
});

// FUNNEL 2 - OUTBOUND: Hospertz inputs a lead -> Priya sends the FIRST message
// POST /send-first-message
// Body: { "name": "Dr. Sharma", "phone": "9876543210", "projectHint": "200-bed hospital in Pune" }
app.post('/send-first-message', async (req, res) => {
  try {
    const { name, phone, projectHint } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required (10-digit Indian number)' });
    const cleanPhone = phone.toString().replace(/^(\+91|91)/, '').replace(/\D/g, '');
    const fullPhone  = '91' + cleanPhone;
    if (!leadProfiles[fullPhone]) leadProfiles[fullPhone] = {};
    if (name)        leadProfiles[fullPhone].name        = name;
    if (projectHint) leadProfiles[fullPhone].projectHint = projectHint;
    const openingPrompt = `You are starting an outbound WhatsApp conversation with ${name || 'a doctor or hospital admin'}.
${projectHint ? 'They may be interested in: ' + projectHint + '.' : ''}
Write a warm friendly first WhatsApp message as Priya from Hospertz. Keep it under 60 words. Do not be salesy - just introduce yourself and ask if they would like to know more about hospital design or construction.`;
    const reply = await callGemini(fullPhone, openingPrompt);
    const sendResult = await sendWhatsAppMessage(cleanPhone, reply);
    console.log(`[OUTBOUND -> ${cleanPhone}]: ${reply}`);
    res.json({ status: 'sent', phone: cleanPhone, name, message: reply, interakt: sendResult });
  } catch (err) {
    console.error('Outbound error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// VIEW ALL LEADS - GET /leads
app.get('/leads', (req, res) => {
  const leads = Object.entries(leadProfiles).map(([phone, profile]) => ({
    phone,
    ...profile,
    messages: conversations[phone]?.length || 0,
    lastMessage: conversations[phone]?.slice(-1)?.[0]?.content?.slice(0, 80) || ''
  }));
  res.json({ total: leads.length, leads });
});

// TEST ENDPOINT
app.get('/test', async (req, res) => {
  const result = { gemini: null, interakt: null, errors: [] };
  try {
    const reply = await callGemini('test_debug_' + Date.now(), 'Hello, I want to set up a 100-bed hospital');
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
  res.json({
    status:    'Priya is live',
    ai:        'Gemini 2.5 Flash',
    funnels: {
      inbound:  'Customer texts Hospertz WA -> Priya auto-replies  [POST /api/webhook]',
      outbound: 'Input a lead -> Priya sends first msg             [POST /send-first-message]'
    },
    endpoints: { test: 'GET /test', leads: 'GET /leads', outbound: 'POST /send-first-message {name, phone, projectHint}' },
    meetLink:  CONFIG.MEET_LINK,
    timestamp: new Date().toISOString()
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`Priya running on port ${CONFIG.PORT}, Gemini key set: ${!!CONFIG.GEMINI_API_KEY}`);
});
