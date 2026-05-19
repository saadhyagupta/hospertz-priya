// ── HOSPERTZ WHATSAPP AI AGENT – DHWANI ──────────────────────────────────────
// Stack: Node.js + Express + Groq (Llama 3.1) + Interakt WhatsApp API
// Deploy free on: railway.app
//
// CONVERSATION DESIGN:
//   1. New contact sends ANY message → server sends options menu (text with 3 choices).
//      If you have an approved Interakt button template, set WELCOME_TEMPLATE env var
//      and it will send that instead (with text as automatic fallback).
//   2. User picks option (button tap OR typing 1/2/3 OR keywords like "renovation") →
//      server runs a structured requirements questionnaire step-by-step.
//   3. User confirms meeting booking ("Done"/"Booked") → Dhwani AI activates.
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
  // Optional: name of approved Interakt button template. Leave blank to use text menu.
  WELCOME_TEMPLATE:  process.env.WELCOME_TEMPLATE  || '',
  PORT:              process.env.PORT              || 3000
};

// ── IN-MEMORY STORES ──────────────────────────────────────────────────────────
const conversations = {}; // { phone: [{ role, content }] }
const leadProfiles  = {}; // { phone: { name, email, city, projectType, ... } }

// ── FLOW STATE MACHINE ────────────────────────────────────────────────────────
// { path, step }
//   path → null (options menu sent, waiting for pick)
//         'NEW_HOSPITAL' | 'RENOVATION' | 'EXPERT'  (questionnaire in progress)
//         'DHWANI'  (AI takes over after meeting confirmed)
const contactFlow = new Map();

function getFlow(phone)        { return contactFlow.get(phone); }
function setFlow(phone, patch) {
  const cur = contactFlow.get(phone) || { path: null, step: 0 };
  contactFlow.set(phone, { ...cur, ...patch });
  console.log(`[FLOW] ${phone} →`, contactFlow.get(phone));
}

// ── QUESTIONNAIRE STEPS ───────────────────────────────────────────────────────
// Tokens: {name} {meetLink}
const QUESTIONNAIRE = {

  NEW_HOSPITAL: [
    {
      key: 'city',
      ask: `Great! 🏗️ We've built 100+ hospitals across India — including a 200-bed greenfield in Mumbai and modular OT complexes in Nashik.

Which *city* is your project in?`
    },
    {
      key: 'beds',
      ask: `Got it! Approximately how many *beds* are you planning?`
    },
    {
      key: 'name',
      ask: `Thanks! May I have your *name*, please?`
    },
    {
      key: 'email',
      ask: `Thanks {name}! 😊 Could I get your *email address*?

Our team will send you a customised layout & proposal before the call.`
    },
    {
      key: 'meeting',
      isMeeting: true,
      ask: `Perfect, {name}! 🎉

Our *healthcare infrastructure specialist* is ready to connect with you for a FREE 30-min consultation.

Book your slot here 👇
📅 *{meetLink}*

Reply *Done* once you've booked! ✅`
    }
  ],

  RENOVATION: [
    {
      key: 'renovType',
      ask: `Perfect! 🔧 What type of work do you need?

*1️⃣* Operation Theatre (OT) setup
*2️⃣* ICU / NICU / PICU
*3️⃣* Hospital renovation / interior
*4️⃣* Expansion / new wing

Reply with *1*, *2*, *3* or *4* 👇`
    },
    {
      key: 'city',
      ask: `Got it! Which *city* is the project in?`
    },
    {
      key: 'size',
      ask: `And roughly how many *beds / OTs* are involved?`
    },
    {
      key: 'name',
      ask: `May I have your *name*, please?`
    },
    {
      key: 'email',
      ask: `Thanks {name}! 😊 What's your *email address*?

Our team will send you a tailored proposal with NABH compliance details before the call.`
    },
    {
      key: 'meeting',
      isMeeting: true,
      ask: `Wonderful, {name}! 🎉

Our *healthcare infrastructure specialist* will walk through your requirements in a FREE 30-min call.

Book your slot here 👇
📅 *{meetLink}*

Reply *Done* once you've booked! ✅`
    }
  ],

  EXPERT: [
    {
      key: 'name',
      ask: `Absolutely! 😊 May I have your *name* first?`
    },
    {
      key: 'project',
      ask: `Thanks {name}! In one line — what's your project about?`
    },
    {
      key: 'email',
      ask: `Got it! And your *email address*, please?

Our specialist will send a pre-call brief to your email before the meeting.`
    },
    {
      key: 'meeting',
      isMeeting: true,
      ask: `Perfect, {name}! 🎉

Book your FREE 30-min consultation with our *healthcare infrastructure specialist* here 👇
📅 *{meetLink}*

Reply *Done* once you've booked! ✅`
    }
  ]
};

// ── HOSPERTZ PORTFOLIO (for Dhwani AI) ───────────────────────────────────────
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

// ── DHWANI SYSTEM PROMPT ─────────────────────────────────────────────────────
function buildSystemPrompt(phone) {
  const p     = leadProfiles[phone] || {};
  const known = Object.keys(p).length > 0 ? JSON.stringify(p) : 'nothing yet';
  const meetingInfo = p.meetingDate
    ? `Meeting scheduled: ${p.meetingDate}${p.meetingTime ? ' at ' + p.meetingTime : ''} (IST) with our healthcare infrastructure specialist.`
    : '';

  return `You are Dhwani, a warm and professional sales representative from Hospertz India Pvt. Ltd.

WHAT IS HOSPERTZ:
Hospertz India Pvt. Ltd. is a HEALTHCARE INFRASTRUCTURE company. We EXCLUSIVELY design, build, and renovate hospitals, clinics, medical colleges, and diagnostic centres. We do NOT work on houses, homes, offices, residential apartments, or any commercial/non-medical spaces. Website: www.hospertz.com

${HOSPERTZ_PORTFOLIO}

FOUNDER: Dr. Vishal Jadhav – 15+ years expertise, 100+ hospital projects across India.

YOUR PERSONA:
- Warm, friendly, helpful — like a knowledgeable colleague
- Write in simple English, short sentences, WhatsApp style
- Use occasional emojis (😊 📅 🏥) but keep it professional
- Keep each reply under 90 words — never write long paragraphs

CONTEXT: This lead has scheduled a FREE consultation with our healthcare infrastructure specialist.
${meetingInfo}
Your job: keep them engaged, answer questions about Hospertz, and reassure them about the upcoming meeting.

LEAD INFO (already collected): ${known}

CRITICAL RULES:
- NEVER ask if someone wants house renovation, office renovation, or any non-hospital work
- NEVER assume a lead wants residential or commercial construction — Hospertz ONLY does hospitals/clinics/healthcare
- When someone says "renovation" always assume they mean HOSPITAL renovation
- If a lead is NOT related to hospital/healthcare, politely explain Hospertz only serves healthcare facilities
- NEVER make up prices or timelines
- ALWAYS stay in character as Dhwani from Hospertz
- If asked about the meeting, say our specialist will call them at the scheduled time and the team can be reached at hospertz@gmail.com
- Keep responses SHORT — this is WhatsApp, not email
- Our website is www.hospertz.com`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fillTokens(text, data) {
  // Use last word of name if first word is a title like "Dr." / "Mr." / "Mrs."
  const TITLES = ['dr.','mr.','mrs.','ms.','prof.','dr','mr','mrs','ms','prof'];
  let firstName = 'there';
  if (data && data.name) {
    const parts = data.name.trim().split(/\s+/);
    const first = parts[0].toLowerCase();
    firstName = TITLES.includes(first) ? (parts[1] || parts[0]) : parts[0];
  }
  return text
    .replace(/\{name\}/g,     firstName)
    .replace(/\{meetLink\}/g, CONFIG.MEET_LINK);
}

function extractLeadInfo(phone, text, customerName) {
  if (!leadProfiles[phone]) leadProfiles[phone] = {};
  const p = leadProfiles[phone];
  const t = text.toLowerCase();
  if (customerName && !p.name) p.name = customerName;
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && !p.email) p.email = emailMatch[0];
  if (!p.city) {
    const cities = ['mumbai','pune','delhi','bangalore','bengaluru','hyderabad','chennai','nagpur','nashik','aurangabad','kolhapur','thane','navi mumbai','ahmedabad','surat','jaipur','lucknow','bhopal','indore'];
    for (const c of cities) {
      if (t.includes(c)) { p.city = c.charAt(0).toUpperCase() + c.slice(1); break; }
    }
  }
}

// ── DETECT WHICH PATH TO START ────────────────────────────────────────────────
// Works for button taps AND typed text ("need renovation", "1", "ot setup", etc.)
function detectPath(text, buttonTitle, buttonId) {
  const t = (text || '').toLowerCase().trim();
  const b = (buttonTitle || '').toLowerCase();
  const i = (buttonId   || '').toLowerCase();

  // NEW HOSPITAL
  if (
    t === '1' || t === 'new hospital setup' ||
    b.includes('new hospital') || i.includes('new_hospital') ||
    t.includes('new hospital') || t.includes('greenfield') ||
    t.includes('turnkey') || t.includes('build') || t.includes('setup') ||
    t.includes('start hospital') || t.includes('open hospital')
  ) return 'NEW_HOSPITAL';

  // RENOVATION / OT
  if (
    t === '2' || t === 'renovation / ot' ||
    b.includes('renovation') || i.includes('renovation') ||
    t.includes('renov') || t.includes('renovat') ||
    t.includes(' ot ') || t.startsWith('ot ') || t.endsWith(' ot') || t === 'ot' ||
    t.includes('operation theatre') || t.includes('modular ot') ||
    t.includes('icu') || t.includes('nicu') || t.includes('picu') ||
    t.includes('expansion') || t.includes('upgrade') ||
    t.includes('interior') || t.includes('redesign')
  ) return 'RENOVATION';

  // EXPERT
  if (
    t === '3' || t === 'talk to expert' ||
    b.includes('expert') || i.includes('expert') ||
    t.includes('expert') || t.includes('talk') || t.includes('speak') ||
    t.includes('call') || t.includes('consult')
  ) return 'EXPERT';

  return null;
}

// ── SEND TEXT VIA INTERAKT ────────────────────────────────────────────────────
async function sendWhatsAppMessage(phone, message) {
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${CONFIG.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      countryCode: '+91',
      phoneNumber: phone.replace(/^91/, ''),
      callbackData: 'dhwani_reply',
      type: 'Text',
      data: { message }
    })
  });
  const data = await res.json();
  console.log('Interakt:', JSON.stringify(data));
  return data;
}

// ── SEND OPTIONS MENU ─────────────────────────────────────────────────────────
// Tries approved button template first; falls back to numbered text menu.
async function sendOptionsMenu(phone, name) {
  const cleanPhone = phone.replace(/^91/, '');
  const firstName  = name ? name.split(' ')[0] : 'there';

  // Attempt: button template (only if WELCOME_TEMPLATE is set)
  if (CONFIG.WELCOME_TEMPLATE) {
    try {
      const res = await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${CONFIG.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: '+91', phoneNumber: cleanPhone, callbackData: 'hospertz_options',
          type: 'Template',
          template: { name: CONFIG.WELCOME_TEMPLATE, languageCode: 'en', bodyValues: [firstName] }
        })
      });
      const data = await res.json();
      if (data.result === true || data.id) {
        console.log(`[MENU] Button template sent to ${phone}`);
        return;
      }
      console.log(`[MENU] Template rejected: ${JSON.stringify(data)} — using text fallback`);
    } catch (e) {
      console.log(`[MENU] Template error: ${e.message} — using text fallback`);
    }
  }

  // Fallback: text menu (always works, no template approval needed)
  const msg =
`Hi ${firstName}! 👋 Welcome to *HOSPERTZ INDIA PVT LTD* 🏥

We design & build world-class hospitals across India 🇮🇳

What are you looking for? Please choose below 👇

*1️⃣  New Hospital Setup*
(Greenfield / Turnkey)

*2️⃣  Renovation / OT*
(ICU, OT, expansion, interiors)

*3️⃣  Talk to Expert*
(Free 30-min call with our healthcare specialist)

Reply *1*, *2*, or *3* 👇`;

  await sendWhatsAppMessage(phone, msg);
  console.log(`[MENU] Text menu sent to ${phone}`);
}

// ── GROQ (Llama 3.1 8B) ───────────────────────────────────────────────────────
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 300, messages }),
    signal: AbortSignal.timeout(25000)
  });

  if (!res.ok) {
    const err = await res.text();
    if (retryCount < 2 && (res.status >= 500 || res.status === 429)) {
      await new Promise(r => setTimeout(r, retryCount === 0 ? 3000 : 8000));
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

// ── ADVANCE QUESTIONNAIRE ─────────────────────────────────────────────────────
async function advanceQuestionnaire(phone, answerText) {
  const flow  = getFlow(phone);
  if (!flow || !flow.path || flow.path === 'DHWANI') return;

  const steps       = QUESTIONNAIRE[flow.path];
  const currentStep = steps[flow.step];
  if (!leadProfiles[phone]) leadProfiles[phone] = {};

  // ── Save answer ───────────────────────────────────────────────────────────
  if (currentStep.key === 'renovType') {
    const map = { '1': 'OT setup', '2': 'ICU/NICU setup', '3': 'Hospital renovation', '4': 'Expansion/new wing' };
    leadProfiles[phone].projectType = map[answerText.trim()] || answerText;
  } else {
    leadProfiles[phone][currentStep.key] = answerText;
    // Also sync common named fields
    if (currentStep.key === 'name')        leadProfiles[phone].name        = answerText;
    if (currentStep.key === 'email')       leadProfiles[phone].email       = answerText;
    if (currentStep.key === 'city')        leadProfiles[phone].city        = answerText;
    if (currentStep.key === 'meetingDate') leadProfiles[phone].meetingDate = answerText;
  }

  // ── Meeting confirmation step (isMeeting = true) ────────────────────────
  if (currentStep.isMeeting) {
    const t = answerText.toLowerCase();
    const confirmed = t.includes('done') || t.includes('book') || t.includes('scheduled') ||
                      t.includes('confirm') || t.includes('yes') || t.includes('ok') ||
                      t.includes('booked') || t.includes('fixed');
    if (!confirmed) {
      // Not yet confirmed — remind them gently
      const firstName = (leadProfiles[phone]?.name || '').split(' ')[0] || 'there';
      await sendWhatsAppMessage(phone,
        `No worries ${firstName}! 😊 whenever you're ready, book your slot here and reply *Done*:\n\n📅 ${CONFIG.MEET_LINK}`);
      return;
    }
    // ── Confirmed ─────────────────────────────────────────────────────────
    leadProfiles[phone].meetingBooked = true;
    setFlow(phone, { path: 'DHWANI', step: 0 });
    const p         = leadProfiles[phone];
    const firstName = (p.name || '').split(' ')[0] || 'there';
    // Confirm to the lead
    const confirmMsg =
`Thank you, ${firstName}! 🎉

Your booking is confirmed! ✅

Our *healthcare infrastructure specialist* will connect with you at your booked slot.

You'll also receive a calendar invite and pre-call brief at *${p.email || 'your email'}* 📧

Looking forward to understanding your project! 🏥`;
    await sendWhatsAppMessage(phone, confirmMsg);
    // ── Internal alert to Hospertz team ──────────────────────────────────
    const alertMsg =
`🔔 *NEW MEETING BOAKED*

👠Name: ${p.name || 'Unknown'}
📞 Phone: +${p.phone}
📦 Email: ${p.email || '-'}
🏥 Project: ${p.projectType || '-'}
📍 City: ${p.city || '-'}
📊 Beds/Size: ${p.beds || p.size || '-'}
🔗 Booked via: ${CONFIG.MEET_LINK}

Please review the Calendly booking and prepare for the call.`;
    try {
      await sendWhatsAppMessage(CONFIG.ALERT_PHONE.replace(/^91/, ''), alertMsg);
      console.log(`[ALERT] Meeting booked alert sent to team for ${phone}`);
    } catch (alertErr) {
      console.error('[ALERT] Failed to send team alert:', alertErr.message);
    }
    return;
  }
  // ── Move to next step ─────────────────────────────────────────────────────
  const nextIdx  = flow.step + 1;
  const nextStep = steps[nextIdx];
  if (!nextStep) {
    setFlow(phone, { path: 'DHWANI', step: 0 });
    return;
  }
  setFlow(phone, { step: nextIdx });
  await sendWhatsAppMessage(phone, fillTokens(nextStep.ask, leadProfiles[phone]));
}

// ── INBOUND WEBHOOK ───────────────────────────────────────────────────────────
// DHWANI PAUSED — Interakt workflow handles all inbound WhatsApp conversations
app.post('/api/webhook', async (req, res) => {
  try {
    // Dhwani is paused. Acknowledge webhook but send no WhatsApp replies.
    // Interakt's "Hospertz - Ad Lead Flow" workflow handles all conversations.
    return res.status(200).json({ status: 'paused - interakt handles' });

    // ── PAUSED CODE BELOW (kept for easy re-activation) ──────────────────────
    const body     = req.body;
    const customer = body?.data?.customer;
    const message  = body?.data?.message;
    if (!customer || !message) return res.status(200).json({ status: 'ignored', reason: 'no customer/message' });
    if (message?.chat_message_type !== 'CustomerMessage')
      return res.status(200).json({ status: 'ignored', reason: 'not customer message' });
    const phone       = customer?.phone_number || customer?.id;
    const text        = message?.message || '';
    const name        = customer?.traits?.name || '';
    const buttonTitle = message?.button_reply?.title || message?.interactive?.button_reply?.title || '';
    const buttonId    = message?.button_reply?.id    || message?.interactive?.button_reply?.id    || '';
    if (!phone || !text) return res.status(200).json({ status: 'ignored', reason: 'no phone/text' });
    console.log(`[IN] ${phone} | "${text}" | btn:"${buttonTitle}"`);
    extractLeadInfo(phone, text, name);
    res.status(200).json({ status: 'processing' });
    const flow = getFlow(phone);
    //w(phone);

    // ════════════════════════════════════════════════════════════════════════
    // STATE 1: Brand-new contact (no flow entry yet)
    // → Send options menu, then wait for their pick
    // ════════════════════════════════════════════════════════════════════════
    if (!flow) {
      // First check if their very first message already implies a path
      const firstPath = detectPath(text, buttonTitle, buttonId);
      if (firstPath) {
        // They said "need renovation" or "new hospital" right away → skip menu
        setFlow(phone, { path: firstPath, step: 0 });
        const firstQ = fillTokens(QUESTIONNAIRE[firstPath][0].ask, leadProfiles[phone] || {});
        await sendWhatsAppMessage(phone, firstQ);
      } else {
        // Generic greeting → show the options menu
        setFlow(phone, { path: null, step: 0 });
        await sendOptionsMenu(phone, name);
      }
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // STATE 2: Options menu was sent, waiting for pick
    // ════════════════════════════════════════════════════════════════════════
    if (flow.path === null) {
      const path = detectPath(text, buttonTitle, buttonId);
      if (path) {
        setFlow(phone, { path, step: 0 });
        const firstQ = fillTokens(QUESTIONNAIRE[path][0].ask, leadProfiles[phone] || {});
        await sendWhatsAppMessage(phone, firstQ);
      } else {
        // Unrecognised input — re-prompt with the menu again
        await sendOptionsMenu(phone, leadProfiles[phone]?.name || name);
      }
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // STATE 3: Dhwani AI is fully active (meeting confirmed)
    // ════════════════════════════════════════════════════════════════════════
    if (flow.path === 'DHWANI') {
      console.log(`[DHWANI] responding to ${phone}`);
      try {
        const reply = await callGroq(phone, text);
        await sendWhatsAppMessage(phone, reply);
      } catch (e) {
        console.error('Dhwani error:', e.message);
        try { await sendWhatsAppMessage(phone, "Hi! Brief technical issue — please resend! 😊"); }
        catch (_) {}
      }
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // STATE 4: Questionnaire in progress
    // ════════════════════════════════════════════════════════════════════════
    if (QUESTIONNAIRE[flow.path]) {
      console.log(`[FLOW] ${phone} in ${flow.path} step ${flow.step} — answer: "${text}"`);
      await advanceQuestionnaire(phone, text);
      return;
    }

  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).json({ status: 'error', message: err.message });
  }
});

// ── ADMIN ENDPOINTS ───────────────────────────────────────────────────────────
app.post('/activate-dhwani', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  setFlow(phone, { path: 'DHWANI', step: 0 });
  res.json({ status: 'ok', phone, flow: 'DHWANI' });
});

app.post('/reset-contact', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  contactFlow.delete(phone);
  delete conversations[phone];
  delete leadProfiles[phone];
  console.log(`[ADMIN] ${phone} reset`);
  res.json({ status: 'reset', phone });
});

app.get('/leads', (req, res) => {
  const leads = Object.entries(leadProfiles).map(([phone, profile]) => {
    const f = contactFlow.get(phone) || {};
    return { phone, ...profile,
      messages:    conversations[phone]?.length || 0,
      lastMessage: conversations[phone]?.slice(-1)?.[0]?.content?.slice(0, 100) || '',
      flowPath:    f.path  ?? 'none',
      flowStep:    f.step  ?? 0 };
  });
  res.json({ total: leads.length, leads });
});

// ── OUTBOUND (send brand intro + Dhwani follow-up) ────────────────────────────
app.post('/send-first-message', async (req, res) => {
  try {
    const { name, phone, projectHint } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    const cleanPhone = phone.toString().replace(/^(\+91|91)/, '').replace(/\D/g, '');
    const fullPhone  = '91' + cleanPhone;

    if (!leadProfiles[fullPhone]) leadProfiles[fullPhone] = {};
    if (name)        leadProfiles[fullPhone].name        = name;
    if (projectHint) leadProfiles[fullPhone].projectHint = projectHint;

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

    await sendWhatsAppMessage(cleanPhone, BRAND_INTRO);
    await new Promise(r => setTimeout(r, 1500));

    const prompt = `You are starting an outbound WhatsApp conversation with ${name || 'a doctor/hospital admin'} about HOSPITAL or HEALTHCARE INFRASTRUCTURE.${projectHint ? ` Context: ${projectHint}.` : ''} Hospertz ONLY builds/renovates hospitals, clinics and medical colleges — NOT houses or offices. Write a warm, short follow-up (under 50 words) as Dhwani from Hospertz. Ask ONE question about their HOSPITAL project.`;
    const followUp = await callGroq(fullPhone, prompt);
    await sendWhatsAppMessage(cleanPhone, followUp);

    setFlow(fullPhone, { path: null, step: 0 }); // outbound → show options menu, Dhwani only after meeting booked

    res.json({ status: 'sent', phone: cleanPhone, name, intro: 'sent', followUp });
  } catch (err) {
    console.error('Outbound error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/test', async (req, res) => {
  const result = { groq: null, interakt: null, errors: [], meetLink: CONFIG.MEET_LINK };
  try {
    const reply = await callGroq('test_' + Date.now(), 'Hello, I want to set up a 100-bed hospital in Pune');
    result.groq = { ok: true, reply };
  } catch (e) { result.groq = { ok: false, error: e.message }; result.errors.push('Groq: ' + e.message); }
  if (result.groq?.ok) {
    try {
      const r = await sendWhatsAppMessage(CONFIG.ALERT_PHONE.replace(/^91/, ''), 'Test: ' + result.groq.reply.slice(0, 80));
      result.interakt = { ok: true, response: r };
    } catch (e) { result.interakt = { ok: false, error: e.message }; result.errors.push('Interakt: ' + e.message); }
  }
  res.json(result);
});

app.get('/', (req, res) => res.json({
  status:   'Dhwani is live ✅',
  ai:       'Groq Llama 3.1 8B Instant',
  meetLink: CONFIG.MEET_LINK,
  flow: {
    '1_new_contact':    'Server sends options menu (text, no Interakt Journey needed)',
    '2_option_picked':  'Server runs step-by-step questionnaire',
    '3_meeting_booked': 'User replies Done → Dhwani AI activates'
  },
  endpoints: {
    test:           'GET  /test',
    leads:          'GET  /leads',
    outbound:       'POST /send-first-message  { name, phone, projectHint }',
    activateDhwani: 'POST /activate-dhwani     { phone }',
    reset:          'POST /reset-contact       { phone }'
  },
  timestamp: new Date().toISOString()
}));

app.listen(CONFIG.PORT, () => {
  console.log(`Dhwani on port ${CONFIG.PORT} | Groq: ${!!CONFIG.GROQ_API_KEY} | Meet: ${CONFIG.MEET_LINK}`);
});
