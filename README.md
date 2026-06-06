# Church Reminder — Backend Server

This is a simple proxy server that sits between your Church Reminder Android app
and the Africa's Talking API. It solves the CORS issue that prevents direct API
calls from mobile apps and browsers.

## Deploy to Render.com (FREE — takes 5 minutes)

### Step 1 — Push this folder to GitHub
1. Create a new GitHub repo called `ChurchReminderServer`
2. Upload all files in this folder to that repo

### Step 2 — Deploy on Render
1. Go to https://render.com and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select the `ChurchReminderServer` repo
5. Fill in these settings:
   - **Name**: church-reminder-server
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
6. Click **"Create Web Service"**
7. Wait 2–3 minutes for it to deploy
8. Copy your server URL — it looks like:
   `https://church-reminder-server.onrender.com`

### Step 3 — Add your server URL to the app
In the Church Reminder Android app:
- Go to **Settings**
- Paste your Render server URL into the **Server URL** field
- Save

That's it! The app will now route all API calls through your server.

## API Endpoints

### POST /send-sms
Send an SMS to a phone number.
Body (JSON):
```json
{
  "username": "your_at_username",
  "apikey": "your_at_api_key",
  "to": "+2348012345678",
  "message": "Your reminder message",
  "from": ""
}
```

### POST /send-call
Initiate a voice call.
Body (JSON):
```json
{
  "username": "your_at_username",
  "apikey": "your_at_api_key",
  "to": "+2348012345678",
  "from": "+2341234567890"
}
```

### GET /
Health check — returns `{"status": "Church Reminder Server is running!"}`
