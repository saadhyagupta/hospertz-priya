// -- HOSPERTZ WHATSAPP AI AGENT - PRIYA --
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
  PORT:             process.env.PORT              || 3000
};

const conversations = {};
const leadProfiles  = {};

function buildSystemPrompt(phone) {
  const p     = leadProfiles[phone] || {};
  const isNew = !conversations[phone] || conversations[phone].length === 0;
  const known = JSON.stringify(p);
  const intro = "You are Priya, a warm and professional sales representative from Hospertz India Pvt. Ltd. - India's leading hospital interior design, construction and turnkey project company.\n\nABOUT HOSPERTZ:\n- Turnkey hospital design, construction & interior execution across India\n- Services: Greenfield hospital builds, hospital renovation, OT/ICU/NICU setup, modular operation theatres, hospital interiors, space planning, NABH-compliant design\n- 100+ completed hospital projects pan-India\n- Based in Mumbai. Founder: Dr. Vishal Jadhav\n\nYOUR PERSONA:\n- Name: Priya from Hospertz\n- Warm, helpful, professional - like a knowledgeable friend\n- Write in simple English, short sentences, WhatsApp style\n- Use occasional emojis but don't overdo it\n- Never sound robotic or corporate\n- Keep each reply under 80 words\n\n";
  const task = isNew
    ? "FIRST MESSAGE - This lead just submitted a form. Introduce yourself warmly, thank them for their interest, and ask ONE question to understand their project."
    : "ONGOING CONVERSATION - Continue naturally. Qualify the lead: 1. Type of project 2. City/location 3. Budget/scale 4. Timeline 5. Name and designation. Known so far: " + known + ". Once you have enough info, say a Hospertz expert will call them shortly.";
  const rules = "\n\nRULES:\n- Never make up prices or timelines\n- If unsure, say 'Let me get that confirmed for you from our team'\n- Always stay in character as Priya";
  return intro + task + rules;
}

async function callGemini(phone, userMessage) {
  if (!CONFIG.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  if (!conversations[phone]) conversations[phone] = [];
  conversations[phone].push({ role: 'user', content: userMessage });

  const contents = conversations[phone].map(function(msg) {
    return { role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] };
  });

  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt(phone) }] },
    contents: contents,
    generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
  };

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY;
  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (!res.ok) { const err = await res.text(); throw new Error('Gemini error ' + res.status + ': ' + err); }

  const data  = await res.json();
  const reply = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text) || "Hi! I'm Priya from Hospertz. How can I help? 😊";

  conversations[phone].push({ role: 'assistant', content: reply });
  if (conversations[phone].length > 20) conversations[phone] = conversations[phone].slice(-20);
  return reply;
}

async function sendWhatsAppMessage(phone, message) {
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + CONFIG.INTERAKT_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode: '+91', phoneNumber: phone.replace(/^91/, ''), callbackData: 'priya_reply', type: 'Text', data: { message: message } })
  });
  const data = await res.json();
  console.log('Interakt send result:', JSON.stringify(data));
  return data;
}

app.post('/api/webhook', async function(req, res) {
  try {
    const body     = req.body;
    console.log('Webhook received:', JSON.stringify(body));
    const customer = body && body.data && body.data.customer;
    const message  = body && body.data && body.data.message;
    if (!customer || !message) return res.status(200).json({ status: 'ignored', reason: 'no customer or message' });
    if (message.chat_message_type !== 'CustomerMessage') return res.status(200).json({ status: 'ignored', reason: 'not a customer message' });
    const phone = customer.phone_number || customer.id;
    const text  = message.message || '';
    const name  = (customer.traits && customer.traits.name) || '';
    if (!phone || !text) return res.status(200).json({ status: 'ignored', reason: 'no phone or text' });
    console.log('Message from ' + phone + ': ' + text);
    if (!leadProfiles[phone]) leadProfiles[phone] = {};
    if (name) leadProfiles[phone].name = name;
    res.status(200).json({ status: 'processing' });
    try {
      const reply = await callGemini(phone, text);
      console.log('Priya reply to ' + phone + ': ' + reply);
      await sendWhatsAppMessage(phone, reply);
    } catch (aiErr) { console.error('Webhook error:', aiErr.message); }
  } catch (err) { console.error('Handler error:', err.message); res.status(200).json({ status: 'error', message: err.message }); }
});

app.get('/', function(req, res) {
  res.json({ status: 'Priya is live', agent: 'Hospertz WhatsApp AI Agent', ai: 'Google Gemini 1.5 Flash (Free)', webhook: '/api/webhook', conversations: Object.keys(conversations).length, timestamp: new Date().toISOString() });
});

app.listen(CONFIG.PORT, function() {
  console.log('Priya is running on port ' + CONFIG.PORT);
  console.log('Gemini key set: ' + (!!CONFIG.GEMINI_API_KEY));
});
