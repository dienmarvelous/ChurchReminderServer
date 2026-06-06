const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ── Health check ─────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Church Reminder Server is running!' });
});

// ── Send SMS ─────────────────────────────────────
app.post('/send-sms', async (req, res) => {
  const { username, apikey, to, message, from } = req.body;

  if (!username || !apikey || !to || !message) {
    return res.status(400).json({ error: 'Missing required fields: username, apikey, to, message' });
  }

  try {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('to', to);
    body.append('message', message);
    if (from && from.trim()) body.append('from', from.trim());

    const atRes = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': apikey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    const text = await atRes.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }

    const recipients = data?.SMSMessageData?.Recipients || [];
    const anyOk = recipients.some(r => r.status === 'Success' || r.statusCode === 101);
    const statusMsg = data?.SMSMessageData?.Message || text;

    if (!atRes.ok || (recipients.length > 0 && !anyOk)) {
      return res.status(400).json({ error: statusMsg || 'SMS failed', detail: data });
    }

    res.json({ success: true, message: statusMsg, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Make Voice Call ───────────────────────────────
app.post('/send-call', async (req, res) => {
  const { username, apikey, to, from } = req.body;

  if (!username || !apikey || !to || !from) {
    return res.status(400).json({ error: 'Missing fields: username, apikey, to, from (caller number required for calls)' });
  }

  try {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('from', from.trim());
    body.append('to', to);

    const atRes = await fetch('https://voice.africastalking.com/call', {
      method: 'POST',
      headers: {
        'apiKey': apikey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    const text = await atRes.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }

    const entries = data?.entries || [];
    const anyOk = entries.some(e =>
      e.status === 'Queued' || e.status === 'queued'
    );

    if (!atRes.ok || (entries.length > 0 && !anyOk)) {
      return res.status(400).json({ error: data?.errorMessage || text, detail: data });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Church Reminder server running on port ${PORT}`));
