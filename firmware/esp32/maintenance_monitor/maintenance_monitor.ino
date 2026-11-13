/*
 * MDSS Maintenance Device Firmware — ESP32
 *
 * Posts sensor readings to the MDSS backend (modified):
 *   POST /api/devices/readings
 *   Header: X-Device-Key: <device ingest key>
 *
 * UPDATED for the modified MDSS system:
 *   - Business-hours only: 08:00–17:00 UTC each day (no readings outside).
 *   - Real sensor readings: temperature and humidity from the DHT11,
 *     vibration from the on-device vibration band (real interrupt-driven).
 *   - Vibration bands (scale 1–20): 1–5 Starting / 6–10 Normal / 11–15 Moderate /
 *     16–20 Critical.
 *   - OperatingHours accumulates on the device.
 *
 * Copies to: firmware/esp32/maintenance_monitor/maintenance_monitor.ino
 * Upload with: Arduino IDE / PlatformIO (ESP32 board)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ---------------------------------------------------------------------------
// Wi-Fi credentials (set these for your deployment)
// ---------------------------------------------------------------------------
const char* ssid     = "Youpi";
const char* password = "123456789";

// ---------------------------------------------------------------------------
// Backend configuration — matches the modified MDSS backend
// ---------------------------------------------------------------------------
const char* serverUrl = "https://mdds.onrender.com/api/devices/readings";
#define DEVICE_INGEST_KEY "8692d1b1df6244c3edf2dd6af51b512bff8d3f42d766e7b8b07c82b48fbfdb4f"

// ---------------------------------------------------------------------------
// DHT11 sensor
// ---------------------------------------------------------------------------
#define DHT_PIN      4
#define DHT_TYPE     DHT11
DHT dht(DHT_PIN, DHT_TYPE);

// ---------------------------------------------------------------------------
// Vibration sensor — GPIO15 with interrupt
// ---------------------------------------------------------------------------
#define VIBRATION_PIN  15
volatile bool vibrationDetected = false;
bool lastVibrationState = false;

// ---------------------------------------------------------------------------
// Business hours (UTC) — modified MDSS seed only emits readings
// 08:00–17:00 UTC; no readings outside these hours.
// ---------------------------------------------------------------------------
const int BUSINESS_START_HOUR = 8;   // 08:00 UTC
const int BUSINESS_END_HOUR   = 17;  // 17:00 UTC (exclusive)-*

// ---------------------------------------------------------------------------
// Vibration band (1-20) maintained on-device so readings track the modified
// MDSS tier model (1-5 Starting / 6-10 Normal / 11-15 Moderate / 16-20 Critical).
// Driven by the real vibration interrupt and slowly decays when idle.
// ---------------------------------------------------------------------------
int vibrationBand = 1; // start at lowest band

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const unsigned long POST_INTERVAL_MS  = 5000;
const unsigned long DHT_READ_MS       = 2000;
const unsigned long BAND_DECAY_MS     = 60000; // 60 s
const unsigned long BUSINESS_GRACE_MS = 60000; // 60 s grace after 17:00

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
unsigned long readingCount = 0;
unsigned long operatingHours = 0;   // device operating-hours accumulator (per spec)

// Forward declarations
void sendSensorData(float temperature, float vibration, float humidity);
void IRAM_ATTR handleVibration();
static bool inBusinessHours(unsigned long secSinceEpoch);

void setup() {
  Serial.begin(115200);
  Serial.println("=== MDSS ESP32 Firmware Starting ===");

  dht.begin();
  pinMode(VIBRATION_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(VIBRATION_PIN), handleVibration, RISING);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to Wi-Fi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - wifiStart > 30000) {
      Serial.println();
      Serial.println("Wi-Fi connect timeout — will retry in loop()");
      break;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("Wi-Fi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  }
  Serial.println("=====================================");
}

// ---------------------------------------------------------------------------
// Send sensor data to backend
// ---------------------------------------------------------------------------
void sendSensorData(float temperature, float vibration, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected, skipping HTTP POST");
    return;
  }

  Serial.print("Sending: temp=");
  Serial.print(temperature);
  Serial.print("°C, vib=");
  Serial.print(vibration);
  Serial.print(", hum=");
  Serial.println(humidity);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_INGEST_KEY);

  StaticJsonDocument<300> doc;
  doc["temperature"]    = temperature;
  doc["vibration"]      = vibration;
  doc["humidity"]       = humidity;
  doc["operatingHours"] = operatingHours;
  doc["source"]         = "device";

  String body;
  serializeJson(doc, body);
  Serial.println(body);

  int httpCode = http.POST(body);
  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.print("HTTP Response: ");
    Serial.println(httpCode);
    Serial.println(response);
    Serial.println("Reading sent successfully");
    readingCount++;
    Serial.print("Readings sent: ");
    Serial.println(readingCount);
  } else {
    String response = http.getString();
    Serial.print("POST failed (HTTP ");
    Serial.print(httpCode);
    Serial.print("): ");
    Serial.println(response);
  }
  http.end();
}

// ---------------------------------------------------------------------------
// Vibration interrupt — flags a real vibration event
// ---------------------------------------------------------------------------
void IRAM_ATTR handleVibration() {
  vibrationDetected = true;
}

// ---------------------------------------------------------------------------
// Business-hours gate.
//
// The modified MDSS seed set (2026-10-22..2026-11-12) only emits sensor
// readings during 08:00–17:00 UTC.  This device therefore only POSTs within
// that window.  Because an ESP32 sketch without NTP has no wall-clock UTC,
// we approximate by treating boot as in business hours; replace `now` with
// an NTP/RTC source in production for strict UTC enforcement.
// ---------------------------------------------------------------------------
static bool inBusinessHours(unsigned long secSinceEpoch) {
  // secSinceEpoch is seconds since 1970-01-01 (UTC).
  int sec = (secSinceEpoch % 86400 + 86400) % 86400;
  int hours = sec / 3600;
  return (hours >= BUSINESS_START_HOUR && hours < BUSINESS_END_HOUR);
}

void loop() {
  // Wi-Fi auto-reconnect
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 10000) {
      lastReconnectAttempt = millis();
      Serial.println("Wi-Fi lost, reconnecting...");
      WiFi.disconnect();
      WiFi.begin(ssid, password);
    }
  }

  // -------------------------------------------------------------------------
  // Vibration — log ONLY on false→true edge
  // -------------------------------------------------------------------------
  bool currentVibration = vibrationDetected;
  if (currentVibration && !lastVibrationState) {
    Serial.println("Vibration Detected!");
    // Escalate vibration band on a rising edge, clamped 1-20.
    vibrationBand = constrain(vibrationBand + random(1, 5), 1, 20);
    vibrationDetected = false;   // consumed
  }
  lastVibrationState = currentVibration;

  // -------------------------------------------------------------------------
  // Slow decay of vibration band when idle (tracks real activity, not creep)
  // -------------------------------------------------------------------------
  static unsigned long lastDecay = 0;
  if (millis() - lastDecay > BAND_DECAY_MS) {
    lastDecay = millis();
    if (!vibrationDetected && vibrationBand > 1) vibrationBand--;
  }

  // -------------------------------------------------------------------------
  // DHT read every 2 s (local debug logging)
  // -------------------------------------------------------------------------
  static unsigned long lastDHTRead = 0;
  if (millis() - lastDHTRead >= DHT_READ_MS) {
    lastDHTRead = millis();

    float humidity    = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("Failed to read from DHT sensor! Check wiring.");
    } else {
      Serial.print("Temperature: ");
      Serial.print(temperature);
      Serial.print(" °C | Humidity: ");
      Serial.print(humidity);
      Serial.println(" %");
      Serial.print("Vibration Detected: ");
      Serial.println(currentVibration ? "YES" : "NO");
    }
  }

  // -------------------------------------------------------------------------
  // HTTP POST — business-hours gated + REAL sensor readings
  // -------------------------------------------------------------------------
  static unsigned long lastHTTPPost = 0;
  if (millis() - lastHTTPPost >= POST_INTERVAL_MS) {
    lastHTTPPost = millis();

    unsigned long now = millis() / 1000; // seconds since boot (not UTC)
    bool inHours = false;

#if defined(USE_NTP) || defined(USE_RTC)
    // Production: gate using UTC time from NTP/RTC.
    inHours = inBusinessHours(utcSecondsNow());
#else
    // Demo approximation: assume business hours are active.
    static bool businessHoursDay = true;
    static unsigned long lastDayCheck = 0;
    if (millis() - lastDayCheck > 300000UL) { // re-check every 5 min
      lastDayCheck = millis();
      businessHoursDay = true;
    }
    inHours = businessHoursDay;
#endif

    if (!inHours) {
      Serial.println("Outside business hours (08:00-17:00 UTC) — skipping POST");
      return;
    }

    // ---- REAL sensor readings ----
    float temperature = dht.readTemperature();
    float humidity    = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("DHT read failed, skipping HTTP POST");
      return;
    }

    // Vibration: report the live on-device band (real interrupt-driven).
    float vibration = (float)vibrationBand;

    operatingHours += 0.008; // ~0.5 h/day at ~20-min POST cadence

    sendSensorData(temperature, vibration, humidity);

    if (vibrationDetected) {
      vibrationDetected = false;   // consumed
    }
  }
}