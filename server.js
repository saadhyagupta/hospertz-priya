// ── HOSPERTZ WHATSAPP AI AGENT — PRIYA ───────────────────────────────────
// Stack: Node.js + Express + Anthropic Claude + Interakt WhatsApp API
// Deploy free on: render.com
// ─────────────────────────────────────────────────────────────────────────

const express = require('express');
const app = express();
app.use(express.json());

const CONFIG = {
  CLAUDE_API_KEY:    process.env.CLAUDE_API_KEY    || '',
  INTERAKT_API_KEY:  process.env.INTERAKT_API_KEY  || 'WmYyYld6ZjB0MEZEVnBxR1U1ODRUbU56ZTlsQmhQYVFBNGsxTmhZYk1mbzo=',
  ALERT_PHONE:       process.env.ALERT_PHONE        || '918369333635',
  BUSINESS_PHONE:    process.env.BUSINESS_PHONE     || '918655963914',
  PORT:              process.env.PORT               || 3000
};

// ── IN-MEMORY STORES ──────────────────────────────────────────────────────
const conversations = {}; // { phone: [{ role, content }] }
const leadProfiles  = {}; // { phone: { name, hospital, city, service, stage } }

// ── PRIYA SYSTEM PROMPT ───────────────────────────────────────────────────
function buildSystemPrompt(phone) {
  const p = leadProfiles[phone] || {};
  const isNew = !conversations[phone] || conversations[phone].length === 0;

  return `You are Priya, a warm and professional sales representative from Hospertz India Pvt. Ltd. — India's leading hospital interior design, construction and turnkey project company.

ABOUT HOSPERTZ:
- Turnkey hospital design, construction & interior execution across India
- Services: Greenfield hospital builds, hospital renovation, OT/ICU/NICU setup, modular operation theatres, hospital interiors, space planning, NABH-compliant design
- 100+ completed hospital projects pan-India
- Based in Mumbai. Founder: Dr. Vishal Jadhav

YOUR PERSONA:
- Name: Priya from Hospertz
- Warm, helpful, professional — like a knowledgeable friend
- Write in simple English, short sentences, WhatsApp style
- Use occasional emojis but don't overdo it
- Never sound robotic or corporate
- Keep each reply under 80 words

${isNew ? `FIRST MESSAGE — This lead just submitted a form. Introduce yourself warmly, thank them for their interest, and ask ONE question to understand their project.` : `ONGOING CONVERSATION — Continue naturally. Your goal is to qualify the lead by finding out:
1. Type of project (greenfield / renovation / interior / OT setup)
2. Location and city
3. Plot/area size if applicable  
4. Bed count and specialty
5. Timeline — when do they want to start?
6. Are they the decision maker?

Once they are clearly interested and have shared key details → suggest a 15-minute video call with our architect.
If they confirm a call or share floor plans → add [HANDOFF] at the very end of your message (hidden from user).`}

LEAD PROFILE SO FAR:
Name: ${p.name || 'Not yet known'}
Hospital: ${p.hospital || 'Not yet known'}
City: ${p.city || 'Not yet known'}
Service Interest: ${p.service || 'Not yet known'}
Stage: ${p.stage || 'New lead'}

RULES:
- Never make up prices or timelines
- If asked about cost say: "Every project is customised — our architect will share a ballpark after a quick call"
- If asked for Sir/founder directly say: "I'll connect you with Dr. Vishal once I understand your project a little better 😊"
- Never say you are an AI
- If lead is rude or spammy, politely disengage`;
}

// ── EXTRACT LEAD INFO FROM CONVERSATION ──────────────────────────────────
function updateLeadProfile(phone, message) {
  if (!leadProfiles[phone]) leadProfiles[phone] = {};
  const p = leadProfiles[phone];
  const msg = message.toLowerCase();

  const cities = ['mumbai','delhi','bangalore','bengaluru','hyderabad','chennai','pune','ahmedabad','kolkata','jaipur','lucknow','surat','nagpur','indore','bhopal','patna','vadodara','ludhiana','agra','nashik'];
  cities.forEach(c => { if (msg.includes(c)) p.city = c.charAt(0).toUpperCase() + c.slice(1); });

  if (msg.includes('greenfield') || msg.includes('new hospital') || msg.includes('new build')) p.service = 'Greenfield hospital';
  if (msg.includes('renovat') || msg.includes('expansion')) p.service = 'Renovation/Expansion';
  if (msg.includes('interior') || msg.includes('design')) p.service = 'Hospital interiors';
  if (msg.includes('ot ') || msg.includes('operation') || msg.includes('modular')) p.service = 'OT/ICU setup';
  if (msg.includes('icu') || msg.includes('nicu')) p.service = 'ICU/NICU setup';
}

// ── CALL CLAUDE ────────────────────────────────────────────────────────────
async function callClaude(phone, userMessage) {
  if (!conversations[phone]) conversations[phone] = [];

  updateLeadProfile(phone, userMessage);
  conversations[phone].push({ role: 'user', content: userMessage });

  const recentHistory = conversations[phone].slice(-12);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: buildSystemPrompt(phone),
      messages: recentHistory
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Claude API error');

  const reply = data.content[0].text;
  conversations[phone].push({ role: 'assistant', content: reply });

  const isHandoff = reply.includes('[HANDOFF]');
  const cleanReply = reply.replace('[HANDOFF]', '').trim();

  return { reply: cleanReply, isHandoff };
}

// ── SEND WHATSAPP VIA INTERAKT ────────────────────────────────────────────
async function sendWhatsApp(toPhone, message) {
  const payload = {
    countryCode: '+91',
    phoneNumber: toPhone.replace('91', '').replace('+91', ''),
    callbackData: 'priya_reply',
    type: 'Text',
    data: { message }
  };

  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + CONFIG.INTERAKT_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  console.log('Interakt send result:', JSON.stringify(result));
  return result;
}

// ── SEND ALERT TO SIR ─────────────────────────────────────────────────────
async function sendAlertToSir(phone, leadProfile, reason) {
  const p = leadProfile || {};
  const message = 
    `🔥 *HOT LEAD ALERT — Hospertz*\n\n` +
    `Name: ${p.name || 'Unknown'}\n` +
    `Phone: ${phone}\n` +
    `Hospital: ${p.hospital || '—'}\n` +
    `City: ${p.city || '—'}\n` +
    `Interest: ${p.service || '—'}\n` +
    `Reason: ${reason}\n\n` +
    `Priya has qualified this lead. Please follow up directly 🙏`;

  await sendWhatsApp(CONFIG.ALERT_PHONE, message);
  console.log('Alert sent to Sir for lead:', phone);
}

// ── WEBHOOK — receives messages from Interakt ─────────────────────────────
app.post('/api/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body));
    res.status(200).json({ status: 'ok' });

    const body = req.body;

    let phone = null;
    let userMessage = null;

    if (body?.data?.customer?.phone_number) {
      phone = '91' + body.data.customer.phone_number.replace(/\D/g, '').slice(-10);
    } else if (body?.customer?.phone_number) {
      phone = '91' + body.customer.phone_number.replace(/\D/g, '').slice(-10);
    }

    if (body?.data?.message?.message) {
      userMessage = body.data.message.message;
    } else if (body?.message?.message) {
      userMessage = body.message.message;
    } else if (body?.data?.message?.text) {
      userMessage = body.data.message.text;
    }

    if (!phone || !userMessage) {
      console.log('Could not extract phone or message from webhook');
      return;
    }

    if (body?.data?.customer?.name || body?.customer?.name) {
      if (!leadProfiles[phone]) leadProfiles[phone] = {};
      leadProfiles[phone].name = body?.data?.customer?.name || body?.customer?.name;
    }

    console.log(`Message from ${phone}: ${userMessage}`);

    const { reply, isHandoff } = await callClaude(phone, userMessage);
    console.log(`Priya reply to ${phone}: ${reply}`);

    await sendWhatsApp(phone, reply);

    if (isHandoff) {
      await sendAlertToSir(phone, leadProfiles[phone], 'Lead requested a call / shared project details');
    }

  } catch (err) {
    console.error('Webhook error:', err.message);
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: '✅ Priya is live',
    agent: 'Hospertz WhatsApp AI Agent',
    webhook: '/api/webhook',
    conversations: Object.keys(conversations).length,
    timestamp: new Date().toISOString()
  });
});

// ── VIEW CONVERSATIONS (for monitoring) ───────────────────────────────────
app.get('/api/conversations', (req, res) => {
  const summary = Object.keys(conversations).map(phone => ({
    phone,
    profile: leadProfiles[phone] || {},
    messageCount: conversations[phone].length,
    lastMessage: conversations[phone][conversations[phone].length - 1]?.content?.slice(0, 100)
  }));
  res.json({ total: summary.length, conversations: summary });
});

app.listen(CONFIG.PORT, () => {
  console.log(`✅ Priya is running on port ${CONFIG.PORT}`);
  console.log(`Webhook URL: https://YOUR-RENDER-URL/api/webhook`);
});
