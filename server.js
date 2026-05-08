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

// ── BRAND INTRO (sent as first message in outbound / inbound) ─────────────────
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

From concept to commissioning, we help doctors and healthcare organisations build fully functional, efficient, and future-ready healthcare facilities.

We have been following your remarkable work and contribution to the medical community and would be honoured to explore a professional association or collaborative opportunity with you in the healthcare ecosystem.

Looking forward to connecting with you! 🤝

Warm regards,
*HOSPERTZ INDIA PVT LTD*
www.hospertz.com`;

// ── FOUNDER INFO ──────────────────────────────────────────────────────────────
const FOUNDER_INFO = `
ABOUT OUR FOUNDER:
Dr. Vishal Jadhav is the founder of Hospertz India Pvt. Ltd. He has 15+ years of deep expertise in hospital planning, healthcare infrastructure, and turnkey hospital project execution. Under his leadership, Hospertz has successfully delivered 100+ hospital projects pan-India, spanning Maharashtra, Karnataka, Rajasthan, Madhya Pradesh, Uttar Pradesh, and more. Dr. Jadhav personally oversees complex projects and is passionate about making world-class healthcare infrastructure accessible across India.
`;

// ── HOSPERTZ PORTFOLIO ────────────────────────────────────────────────────────
const HOSPERTZ_PORTFOLIO = `
HOSPERTZ COMPLETED PROJECTS (reference when relevant):
1. Kohinoor Hospital, Kurla, Mumbai - 150-bed multi-speciality, full turnkey
2. Ruby Hall Clinic Expansion, Pune - ICU & OT block, NABH compliance
3. Global Hospital, Mumbai - Greenfield 200-bed design & construction
4. Navgati Hospital, Nashik - Modular OT complex, 4 operation theatres
5. Sunshine Maternity & NICU, Thane - Complete NICU/PICU design & fit-out
6. LifeCare Diagnostics, Navi Mumbai - Radiology & diagnostic centre
7. MedCure Hospital, Aurangabad - 80-bed renovation + OPD redesign
8. City Ortho & Spine, Pune - Speciality orthopaedic greenfield build
9. Horizon Multispeciality, Nagpur - 120-bed hospital with modular theatres
10. Samarth Hospital, Kolhapur - Full hospital interior + NABH documentation
`;

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
function buildSystemPrompt(phone) {
  const p      = leadProfiles[phone] || {};
  const isNew  = !conversations[phone] || conversations[phone].length === 0;
  const known  = Object.keys(p).length > 0 ? JSON.stringify(p) : 'nothing yet';

  const missing = [
    !p.name        && 'name',
    !p.email       && 'email address',
    !p.projectType && 'project type / requirement',
    !p.city        && 'city/location',
  ].filter(Boolean);

  const hasRequirements = p.projectType || p.projectHint;
  const hasContact      = p.name && p.email;

  return `You are Priya, a warm and professional representative from Hospertz India Pvt. Ltd.

${HOSPERTZ_PORTFOLIO}
${FOUNDER_INFO}

YOUR PERSONA:
- You speak as the Hospertz team, warm and professional
- Write in simple English, WhatsApp style — short paragraphs, not walls of text
- Use emojis tastefully (not every sentence)
- Keep replies under 120 words unless sharing the intro or services
- Never sound like a bot — sound like a real, helpful colleague

CONVERSATION FLOW — FOLLOW THIS ORDER:
Stage 1 — INTRO: The brand intro has already been sent. Now invite them to share their project/requirement.
Stage 2 — UNDERSTAND REQUIREMENT: Ask what they are looking to build or upgrade. Listen carefully. Ask ONE question at a time. Understand: project type, location, scale (beds/size), timeline.
Stage 3 — CONVINCE & BUILD TRUST: Share 1-2 relevant completed projects from the portfolio. Mention Dr. Vishal Jadhav's expertise. Make them feel Hospertz is the perfect partner.
Stage 4 — COLLECT CONTACT: Ask for their name and email so the team can share a detailed proposal.
Stage 5 — BOOK MEETING: Once you know their requirement and have their contact, push warmly for a meeting. Say something like: "Our founder Dr. Vishal Jadhav would personally love to connect with you for a brief call to understand your vision. Could you share a date and time that works best for you this week or next?" — Then when they give availability, confirm the meeting warmly.
Stage 6 — CONFIRM MEETING: Once they give a time, say: "Wonderful! I have noted your availability. Our team will send you a calendar invite and meeting link to your email shortly. Dr. Jadhav is looking forward to speaking with you!"

CURRENT LEAD INFO: ${known}
${missing.length > 0 ? 'STILL NEED: ' + missing.join(', ') : 'All key info collected.'}

${!hasRequirements ? 'NEXT STEP: Invite them to share their project requirement.' : ''}
${hasRequirements && !hasContact ? 'NEXT STEP: Collect their name and email.' : ''}
${hasContact && hasRequirements ? 'NEXT STEP: Push for meeting. Ask for their date/time availability.' : ''}

${isNew
  ? 'FIRST REPLY: The brand intro was just sent to this lead. Now send a short warm follow-up inviting them to share what they are working on. Keep it to 2-3 lines. Example: "We would love to understand your project better. Are you planning a new hospital, a renovation, or perhaps a specialised setup like an OT or ICU? Do share more and we will guide you from there! 😊"'
  : 'ONGOING: Continue naturally from where the conversation left off.'}

RULES:
- Never make up prices, timelines, or technical specs
- If asked about cost, say: "Our team will prepare a detailed estimate based on your specific requirements — no two projects are the same!"
- Always mention Dr. Vishal Jadhav when talking about leadership/expertise
- After a meeting is agreed upon, confirm warmly and mention the calendar invite will come via email
- Website: www.hospertz.com | Email: hospertz@gmail.com`;
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
    if      (t.includes('new hospital') || t.includes('greenfield') || t.includes('build')) p.projectType = 'Greenfield new hospital';
    else if (t.includes('renovat') || t.includes('expand') || t.includes('upgrade'))        p.projectType = 'Renovation/expansion';
    else if (t.includes('operation theatre') || t.includes('ot'))                           p.projectType = 'OT setup';
    else if (t.includes('icu') || t.includes('nicu') || t.includes('picu'))                 p.projectType = 'ICU/NICU setup';
    else if (t.includes('interior') || t.includes('design') || t.includes('clinic'))        p.projectType = 'Hospital interiors / clinic';
    else if (t.includes('medical college') || t.includes('college'))                        p.projectType = 'Medical college';
  }

  // Detect meeting confirmation
  if (t.includes('monday') || t.includes('tuesday') || t.includes('wednesday') ||
      t.includes('thursday') || t.includes('friday') || t.includes('saturday') ||
      t.includes('sunday') || t.match(/\d{1,2}(am|pm|\s*o'clock)/)) {
    p.availabilityShared = true;
  }

  if (t.includes('confirmed') || t.includes('booked') || t.includes('scheduled')) {
    p.meetingBooked = true;
  }

  leadProfiles[phone] = p;
}

// ── CALL GEMINI ───────────────────────────────────────────────────────────────
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
    generationConfig: { temperature: 0.8, maxOutputTokens: 400 }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (!res.ok) { const err = await res.text(); throw new Error(`Gemini ${res.status}: ${err}`); }

  const data  = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hi! This is Team Hospertz. How can we help you today?";

  conversations[phone].push({ role: 'assistant', content: reply });
  if (conversations[phone].length > 30) conversations[phone] = conversations[phone].slice(-30);
  return reply;
}

// ── SEND WHATSAPP VIA INTERAKT ────────────────────────────────────────────────
async function sendWhatsAppMessage(phone, message) {
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${CONFIG.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      countryCode:  '+91',
      phoneNumber:  phone.replace(/^91/, ''),
      callbackData: 'priya_reply',
      type:         'Text',
      data:         { message }
    })
  });
  const data = await res.json();
  console.log('Interakt send result:', JSON.stringify(data));
  return data;
}

// ── FUNNEL 1: INBOUND ─────────────────────────────────────────────────────────
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

// ── FUNNEL 2: OUTBOUND ────────────────────────────────────────────────────────
// POST /send-first-message
// Body: { "name": "Dr. Sharma", "phone": "9876543210", "projectHint": "100-bed hospital in Pune" }
// Priya sends the brand intro first, then a warm follow-up question
app.post('/send-first-message', async (req, res) => {
  try {
    const { name, phone, projectHint } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const cleanPhone = phone.toString().replace(/^(\+91|91)/, '').replace(/\D/g, '');
    const fullPhone  = '91' + cleanPhone;

    if (!leadProfiles[fullPhone]) leadProfiles[fullPhone] = {};
    if (name)        leadProfiles[fullPhone].name        = name;
    if (projectHint) leadProfiles[fullPhone].projectHint = projectHint;

    // Step 1: Send brand intro
    await sendWhatsAppMessage(cleanPhone, BRAND_INTRO);
    console.log(`[OUTBOUND INTRO -> ${cleanPhone}]`);

    // Small delay so messages arrive in order
    await new Promise(r => setTimeout(r, 1500));

    // Step 2: Send warm follow-up question via Gemini
    const followUpPrompt = `The brand intro has just been sent to ${name || 'this doctor/healthcare professional'}.${projectHint ? ' We know they may be interested in: ' + projectHint + '.' : ''} Now send a short 2-3 line warm follow-up inviting them to share their project or requirement. Be friendly, not salesy.`;

    const followUp = await callGemini(fullPhone, followUpPrompt);
    await sendWhatsAppMessage(cleanPhone, followUp);
    console.log(`[OUTBOUND FOLLOWUP -> ${cleanPhone}]: ${followUp}`);

    res.json({ status: 'sent', phone: cleanPhone, name, intro: 'sent', followUp });
  } catch (err) {
    console.error('Outbound error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── VIEW ALL LEADS ────────────────────────────────────────────────────────────
app.get('/leads', (req, res) => {
  const leads = Object.entries(leadProfiles).map(([phone, profile]) => ({
    phone,
    ...profile,
    messages: conversations[phone]?.length || 0,
    lastMessage: conversations[phone]?.slice(-1)?.[0]?.content?.slice(0, 100) || ''
  }));
  res.json({ total: leads.length, leads });
});

// ── TEST ──────────────────────────────────────────────────────────────────────
app.get('/test', async (req, res) => {
  const result = { gemini: null, interakt: null, errors: [] };
  try {
    const reply = await callGemini('test_debug_' + Date.now(), 'Hello, I am interested in setting up a 100-bed hospital');
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

// ── HOME ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'Priya is live',
    brand:  'Hospertz India Pvt. Ltd. | www.hospertz.com',
    ai:     'Gemini 2.5 Flash',
    funnels: {
      inbound:  'Customer texts Hospertz WA -> Priya replies  [POST /api/webhook]',
      outbound: 'Input lead -> Priya sends brand intro + follow-up  [POST /send-first-message]'
    },
    endpoints: {
      test:     'GET  /test',
      leads:    'GET  /leads',
      outbound: 'POST /send-first-message  { name, phone, projectHint }'
    },
    meetLink:  CONFIG.MEET_LINK,
    timestamp: new Date().toISOString()
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`Priya running on port ${CONFIG.PORT}, Gemini key set: ${!!CONFIG.GEMINI_API_KEY}`);
});
