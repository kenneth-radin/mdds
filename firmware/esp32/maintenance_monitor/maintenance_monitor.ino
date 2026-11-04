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

// ---------------------------------------------------------------------------
// Wi-Fi credentials
// ---------------------------------------------------------------------------
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ---------------------------------------------------------------------------
// Backend configuration
// ---------------------------------------------------------------------------
const char* serverUrl = "https://mdds.onrender.com/api/devices/readings";

// Device ingest key — must match DEVICE_INGEST_KEY in backend/.env
// Replace with your actual key before deploying.
#define DEVICE_INGEST_KEY "REPLACE_WITH_DEVICE_KEY"

// ---------------------------------------------------------------------------
// Sensor pins (adjust to your wiring)
// ---------------------------------------------------------------------------
const int TEMPERATURE_PIN = 34;   // ADC1_CH6 on ESP32
const int VIBRATION_PIN   = 35;   // ADC1_CH7 on ESP32

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const unsigned long POST_INTERVAL_MS = 5000;  // 5 seconds

void setup() {
  Serial.begin(115200);

  pinMode(TEMPERATURE_PIN, INPUT);
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

  // Read raw ADC values (0–4095 on ESP32)
  int tempRaw   = analogRead(TEMPERATURE_PIN);
  int vibRaw    = analogRead(VIBRATION_PIN);

  // Map raw ADC to physical ranges.
  // Temperature: 20–40 °C, Vibration: 0–20 mm/s (matches backend validation).
  float temperature = map(tempRaw, 0, 4095, 20, 40);
  float vibration   = map(vibRaw, 0, 4095, 0, 20);

  if (HTTPClient http; http.begin(serverUrl)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_INGEST_KEY);

    StaticJsonDocument<200> doc;
    doc["temperature"]   = temperature;
    doc["vibration"]     = vibration;
    doc["operatingHours"] = 0;
    doc["timestamp"]      = "";
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