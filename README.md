# BantayAni 🌱

**Soil sensor monitoring, crop & fertilizer recommendation system** with SMS alerts to the farm owner.

Built to the dashboard mockup: green-themed "individual analysis of measured data" panel with live sensor graphs, crop-type recommendations, and fertilizer amount recommendations.

## Features

- **Live sensor dashboard** — soil pH, Nitrogen (N), Phosphorus (P), Potassium (K), moisture, temperature, and EC (salinity), each shown as cards with latest readings and status.
- **Line graphs per sensor** — select any sensor to see its trend over time, with a green band marking the safe range (year / month / data-basis filters included).
- **SMS alerts to owner** — when a sensor reading goes outside its safe range, an SMS is sent to the owner's registered contact number and the alert is logged in the system. (30-minute cooldown per sensor prevents spam.)
- **Crop type recommendation** — matches the current soil pH against a reference table of 60+ crops (vegetables, fruit trees, grains/oil/medicinal) with their suitable pH ranges.
- **Fertilizer amount recommendation** — computes N·P·K deficits against soil standards and estimates application rates (e.g., ≈ kg/ha of Urea, DAP, MOP).
- **Manual data entry** — add readings by hand; they are saved to the system and included in the analysis.
- **Data persistence** — all readings, alerts, and SMS logs are stored in the browser (localStorage).

## Reference data (from soil test standards)

| Nutrient | Standard range | Note |
|---|---|---|
| Available Nitrogen | 30 – 150 mg/kg | Cultivating soil: 90 – 120 mg/kg |
| Available Phosphorus | 3 – 40 mg/kg | Most crops: 10 – 20 mg/kg |
| Available Potassium | 30 – 200 mg/kg | High-yield farmland: 150 – 200 mg/kg |

**Soil pH classification:** <4.5 extremely strong acidity · 4.5–5.5 strongly acidic · 5.5–6.5 acidic · 6.5–7.5 neutral · 7.5–8.5 alkaline · 8.5–9.5 strongly alkaline · >9.5 extremely alkaline.

## Run locally

```bash
node server.js
# open http://localhost:3000
```

Or simply open `index.html` in a browser (no build step — plain HTML/CSS/JS + Chart.js via CDN).

## Connecting a real sensor (IoT)

The dashboard simulates a live feed ("▶ Start sensor feed") that mimics an IoT soil sensor. To connect real hardware (e.g., ESP32 + pH/NPK sensors):

1. The microcontroller reads the sensors and sends each reading to your backend, e.g.:

   ```http
   POST /api/readings
   { "sensor": "ph", "value": 6.4, "source": "sensor" }
   ```

2. The backend stores the reading and calls `checkAlert()` logic — if the value is outside the safe range, it sends an SMS to the owner's number.

## Sending real SMS

Browsers cannot send SMS directly, so the app currently **simulates** SMS (logged in the "SMS log" panel + popup). To send real texts, use a small backend with an SMS gateway such as [Twilio](https://www.twilio.com/):

```js
// server-side (Node.js example)
await twilioClient.messages.create({
  to: ownerContact,
  from: TWILIO_NUMBER,
  message: `[BantayAni] ALERT: ${sensorName} = ${value} — ${status}. ${advice}`,
});
```

Then point the `sendSMS()` hook in `app.js` at that endpoint (`POST /api/sms`).

## Project structure

```
Bantayani/
├── index.html   # dashboard layout
├── styles.css   # green theme styling
├── data.js      # crop pH table, NPK standards, sensor config
├── app.js       # readings, charts, recommendations, SMS alerts
└── server.js    # tiny local dev server
```

## License

MIT
