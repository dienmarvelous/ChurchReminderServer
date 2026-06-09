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

/**
 * GENERIC SMS ENDPOINT
 * Accepts any SMS provider configuration from the app.
 * 
 * Body:
 * {
 *   provider: "africastalking" | "termii" | "twilio" | "custom",
 *   apikey: "your api key",
 *   username: "your username (if required)",
 *   to: "+2348012345678",
 *   message: "Your message",
 *   from: "CHURCH (sender ID)",
 *   sandbox: true/false,
 *   
 *   // For custom/any provider:
 *   customUrl: "https://api.yourprovider.com/sms",
 *   customHeaders: { "Authorization": "Bearer xxx" },
 *   customBody: { "phone": "{to}", "text": "{message}" }
 * }
 */
app.post('/send-sms', async (req, res) => {
  const { provider, apikey, username, to, message, from, sandbox, customUrl, customHeaders, customBody } = req.body;

  if (!to || !message || !apikey) {
    return res.status(400).json({ error: 'Missing required fields: apikey, to, message' });
  }

  try {
    let result;

    switch ((provider || 'africastalking').toLowerCase()) {

      // ── Africa's Talking ──────────────────────────
      case 'africastalking': {
        const body = new URLSearchParams();
        body.append('username', username || 'sandbox');
        body.append('to', to);
        body.append('message', message);
        if (from && from.trim()) body.append('from', from.trim());

        const url = sandbox
          ? 'https://api.sandbox.africastalking.com/version1/messaging'
          : 'https://api.africastalking.com/version1/messaging';

        const atRes = await fetch(url, {
          method: 'POST',
          headers: {
            'apiKey': apikey,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: body.toString()
        });

        const text = await atRes.text();
        if (text === 'Host not in allowlist') {
          return res.status(403).json({ error: 'Host not in allowlist. Clear IP allowlist in Africa\'s Talking Settings.' });
        }

        let data;
        try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }

        const recipients = data?.SMSMessageData?.Recipients || [];
        const anyOk = recipients.some(r => r.status === 'Success' || r.statusCode === 101);
        const statusMsg = data?.SMSMessageData?.Message || text;

        if (!atRes.ok || (recipients.length > 0 && !anyOk)) {
          return res.status(400).json({ error: statusMsg || 'SMS failed', detail: data });
        }
        result = { success: true, message: statusMsg, data };
        break;
      }

      // ── Termii ────────────────────────────────────
      case 'termii': {
        const termiiBody = {
          to: to,
          from: from || 'N-Alert',
          sms: message,
          type: 'plain',
          channel: 'generic',
          api_key: apikey
        };

        const termiiRes = await fetch('https://v3.api.termii.com/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(termiiBody)
        });

        const termiiData = await termiiRes.json();

        if (!termiiRes.ok || termiiData.code === 'ok' === false) {
          return res.status(400).json({ error: termiiData.message || 'Termii SMS failed', detail: termiiData });
        }
        result = { success: true, message: 'Sent via Termii', data: termiiData };
        break;
      }

      // ── Twilio ────────────────────────────────────
      case 'twilio': {
        // username = Account SID, apikey = Auth Token, from = Twilio number
        const twilioBody = new URLSearchParams();
        twilioBody.append('To', to);
        twilioBody.append('From', from || '');
        twilioBody.append('Body', message);

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${username}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${username}:${apikey}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: twilioBody.toString()
          }
        );

        const twilioData = await twilioRes.json();
        if (!twilioRes.ok) {
          return res.status(400).json({ error: twilioData.message || 'Twilio SMS failed', detail: twilioData });
        }
        result = { success: true, message: 'Sent via Twilio', data: twilioData };
        break;
      }

      // ── Custom / Any other provider ───────────────
      case 'custom': {
        if (!customUrl) {
          return res.status(400).json({ error: 'customUrl is required for custom provider' });
        }

        // Replace placeholders in customBody
        let bodyStr = JSON.stringify(customBody || {});
        bodyStr = bodyStr
          .replace(/\{to\}/g, to)
          .replace(/\{message\}/g, message)
          .replace(/\{from\}/g, from || '')
          .replace(/\{apikey\}/g, apikey)
          .replace(/\{username\}/g, username || '');

        const customRes = await fetch(customUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(customHeaders || {})
          },
          body: bodyStr
        });

        const customData = await customRes.json();
        if (!customRes.ok) {
          return res.status(400).json({ error: 'Custom provider SMS failed', detail: customData });
        }
        result = { success: true, message: 'Sent via custom provider', data: customData };
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown provider: ${provider}. Use: africastalking, termii, twilio, or custom` });
    }

    res.json(result);

  } catch (err) {
    console.error('SMS Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GENERIC VOICE CALL ENDPOINT
 */
app.post('/send-call', async (req, res) => {
  const { provider, apikey, username, to, from, sandbox } = req.body;

  if (!to || !apikey || !from) {
    return res.status(400).json({ error: 'Missing required fields: apikey, to, from' });
  }

  try {
    let result;

    switch ((provider || 'africastalking').toLowerCase()) {

      // ── Africa's Talking ──────────────────────────
      case 'africastalking': {
        const body = new URLSearchParams();
        body.append('username', username || '');
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

        if (text === 'Host not in allowlist') {
          return res.status(403).json({ error: 'Host not in allowlist. Clear IP allowlist in Africa\'s Talking Settings.' });
        }

        const entries = data?.entries || [];
        const anyOk = entries.some(e => e.status === 'Queued' || e.status === 'queued');
        if (!atRes.ok || (entries.length > 0 && !anyOk)) {
          return res.status(400).json({ error: data?.errorMessage || text, detail: data });
        }
        result = { success: true, message: 'Call queued', data };
        break;
      }

      // ── Termii (does not support voice) ──────────
      case 'termii':
        return res.status(400).json({ error: 'Termii does not support voice calls. Use Africa\'s Talking or Twilio for calls.' });

      // ── Twilio ────────────────────────────────────
      case 'twilio': {
        const twilioBody = new URLSearchParams();
        twilioBody.append('To', to);
        twilioBody.append('From', from);
        twilioBody.append('Url', 'http://demo.twilio.com/docs/voice.xml');

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${username}/Calls.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${username}:${apikey}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: twilioBody.toString()
          }
        );

        const twilioData = await twilioRes.json();
        if (!twilioRes.ok) {
          return res.status(400).json({ error: twilioData.message || 'Twilio call failed', detail: twilioData });
        }
        result = { success: true, message: 'Call initiated via Twilio', data: twilioData };
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    res.json(result);

  } catch (err) {
    console.error('Call Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Church Reminder server running on port ${PORT}`));
