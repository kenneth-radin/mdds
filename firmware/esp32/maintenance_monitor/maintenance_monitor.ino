/*
 * MDSS Maintenance Device Firmware — ESP32
 *
 * Posts simulated temperature & vibration readings to the MDSS backend:
 *   POST /api/devices/readings
 *   Header: X-Device-Key: <device ingest key>
 *
 * Copies to: firmware/esp32/maintenance_monitor/maintenance_monitor.ino
 * Upload with: Arduino IDE / PlatformIO (ESP32 board)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ---------------------------------------------------------------------------
// Wi-Fi credentials
// ---------------------------------------------------------------------------
// TODO: Replace with your actual Wi-Fi credentials before flashing
const char* ssid     = "PCX 160";
const char* password = "k!Qe16LKa^TTgD";

// ---------------------------------------------------------------------------
// Backend configuration
// ---------------------------------------------------------------------------
const char* serverUrl = "https://mdds.onrender.com/api/devices/readings";

// Device ingest key — must match DEVICE_INGEST_KEY in backend/.env
// Replace with your actual key before deploying.
#define DEVICE_INGEST_KEY "8692d1b1df6244c3edf2dd6af51b512bff8d3f42d766e7b8b07c82b48fbfdb4f"

// ---------------------------------------------------------------------------
// DHT11 sensor
// ---------------------------------------------------------------------------
#define DHT_PIN      4   // GPIO4 (adjust to your wiring)
#define DHT_TYPE     DHT11
DHT dht(DHT_PIN, DHT_TYPE);

// ---------------------------------------------------------------------------
// Vibration sensor (analog, legit)
// ---------------------------------------------------------------------------
const int VIBRATION_PIN = 35;   // ADC1_CH7 on ESP32

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const unsigned long POST_INTERVAL_MS = 5000;  // 5 seconds

void setup() {
  Serial.begin(115200);

  dht.begin();
  pinMode(VIBRATION_PIN, INPUT);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("Wi-Fi connected");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected, retrying...");
    WiFi.reconnect();
    delay(1000);
    return;
  }

  // Read temperature from real DHT11 sensor
  float temperature = dht.readTemperature();
  if (isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor, skipping this cycle");
    delay(POST_INTERVAL_MS);
    return;
  }

  // Read vibration from analog sensor (0–4095 on ESP32)
  int vibRaw = analogRead(VIBRATION_PIN);
  float vibration = map(vibRaw, 0, 4095, 0, 20);

  if (HTTPClient http; http.begin(serverUrl)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_INGEST_KEY);

    StaticJsonDocument<200> doc;
    doc["temperature"]   = temperature;
    doc["vibration"]     = vibration;
    doc["operatingHours"] = 0;
    doc["source"]         = "device";

    String body;
    serializeJson(doc, body);

    int httpCode = http.POST(body);
    if (httpCode > 0) {
      Serial.printf("POST %d %s\n", httpCode, http.getString().c_str());
    } else {
      Serial.printf("POST failed: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  } else {
    Serial.println("Failed to connect to server");
  }

  delay(POST_INTERVAL_MS);
}