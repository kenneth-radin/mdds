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
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ---------------------------------------------------------------------------
// Wi-Fi credentials
// ---------------------------------------------------------------------------
const char* ssid     = "PCX 160";
const char* password = "k!Qe16LKa^TTgD";

// ---------------------------------------------------------------------------
// Backend configuration
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
volatile unsigned long lastTriggerTime = 0;

void IRAM_ATTR handleVibration() {
  unsigned long currentTime = millis();
  if (currentTime - lastTriggerTime > 150) {   // 150 ms debounce
    vibrationDetected = true;
    lastTriggerTime = currentTime;
  }
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const unsigned long POST_INTERVAL_MS = 5000;
const unsigned long DHT_READ_MS      = 2000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
unsigned long readingCount = 0;
bool lastVibrationState = false;   // for edge-detection logging only

// Forward declaration
void sendSensorData(float temperature, float vibration, float humidity);

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
  bool currentVibration = vibrationDetected;   // atomic read of volatile
  if (currentVibration && !lastVibrationState) {
    Serial.println("Vibration Detected!");
  }
  lastVibrationState = currentVibration;
  // NOTE: vibrationDetected is cleared in the POST block below, not here.

  // -------------------------------------------------------------------------
  // DHT read every 2 s
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
  // HTTP POST every 5 s
  // -------------------------------------------------------------------------
  static unsigned long lastHTTPPost = 0;
  if (millis() - lastHTTPPost >= POST_INTERVAL_MS) {
    lastHTTPPost = millis();

    float temperature = dht.readTemperature();
    float humidity    = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("DHT read failed, skipping HTTP POST");
      return;
    }

    // Snapshot, send, THEN clear so this event is reported exactly once
    bool hadVibration = vibrationDetected;
    float vibration   = hadVibration ? 5.0 : 0.0;

    sendSensorData(temperature, vibration, humidity);

    if (hadVibration) {
      vibrationDetected = false;   // consumed by this POST
    }
  }
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

  StaticJsonDocument<200> doc;
  doc["temperature"]    = temperature;
  doc["vibration"]      = vibration;
  doc["humidity"]       = humidity;
  doc["operatingHours"] = 0;
  doc["source"]         = "device";

  String body;
  serializeJson(doc, body);
  Serial.println(body);

  int httpCode = http.POST(body);
  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response: ");
    Serial.println(httpCode);
    Serial.println(response);
    Serial.println("Reading sent successfully");
    readingCount++;
    Serial.print("Readings sent: ");
    Serial.println(readingCount);
  } else {
    Serial.print("POST failed: ");
    Serial.println(http.errorToString(httpCode));
  }
  http.end();
}