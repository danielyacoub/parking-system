/*
 * HK Parking — ESP32 dashboard bridge
 * ===================================
 * This sketch uses the same LCD, servo, LED, and sensor logic as the
 * original ESP32_SmartParking sketch, but publishes MQTT messages in the
 * format expected by the HK Parking dashboard.
 *
 * Dashboard MQTT contract:
 *
 *   Slot state:
 *     parking/slots/SLOT-001/state
 *     {"occupied":true}
 *
 *   Gate event:
 *     parking/gates/GATE-IN-01/event
 *     {"event":"OPENED","triggeredBy":"MQTT_SENSOR"}
 *
 * Important:
 *   - SLOT-001 to SLOT-004 are the four parking sensors (P1-P4).
 *   - Gate events are NOT retained. The dashboard records every gate
 *     message as an event in the gate log.
 *   - Slot state is retained so the dashboard can recover the latest
 *     state after reconnecting.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// Wi-Fi and MQTT broker settings live in secrets.h.
// Copy secrets.example.h to secrets.h and fill in your own values.
#include "secrets.h"

// ==================================================
// MQTT BROKER SETTINGS
// ==================================================
// MQTT_SERVER must be the LAN IP address of the computer running Mosquitto.
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "ESP32_SmartParkingDashboard";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastWiFiAttempt = 0;
unsigned long lastMQTTAttempt = 0;
const unsigned long WIFI_RETRY_INTERVAL = 10000;
const unsigned long MQTT_RETRY_INTERVAL = 5000;
bool wifiWasConnected = false;

// ==================================================
// DASHBOARD IDs
// ==================================================
// The dashboard seeds SLOT-001 to SLOT-024. These four map to the
// physical sensors P1-P4.
const char* const SLOT_IDS[4] = {
  "SLOT-001",
  "SLOT-002",
  "SLOT-003",
  "SLOT-004"
};

// These match the gate IDs used by the dashboard seed data.
const char* const ENTRY_GATE_ID = "GATE-IN-01";
const char* const EXIT_GATE_ID = "GATE-OUT-01";

// ==================================================
// LCD SETTINGS
// ==================================================
const int LCD_SDA = 16;
const int LCD_SCL = 17;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ==================================================
// PARKING SLOT SENSORS (P1-P4)
// ==================================================
const int slotIR[4] = {18, 19, 21, 22};

// ==================================================
// ENTRY AND EXIT SENSORS
// ==================================================
const int entryIR = 23;  // IR sensor 5
const int exitIR = 25;   // IR sensor 6
const int IR_DETECTED = LOW;

// ==================================================
// SERVO MOTORS / GATES
// ==================================================
const int entryServoPin = 26;
const int exitServoPin = 27;

Servo entryServo;
Servo exitServo;

const int ENTRY_GATE_CLOSED = 0;
const int ENTRY_GATE_OPEN = 90;
const int EXIT_GATE_CLOSED = 0;
const int EXIT_GATE_OPEN = 90;

const unsigned long GATE_CLOSE_DELAY = 3000;

bool entryGateOpen = false;
bool exitGateOpen = false;
unsigned long entryLastDetectionTime = 0;
unsigned long exitLastDetectionTime = 0;

// ==================================================
// LEDS
// ==================================================
const int greenLED = 32;
const int redLED = 33;

// ==================================================
// PARKING STATUS / TIMERS
// ==================================================
bool occupied[4] = {false, false, false, false};
bool previousOccupied[4] = {false, false, false, false};
bool slotStatusPublished = false;

unsigned long lastLCDUpdate = 0;
const unsigned long LCD_INTERVAL = 500;

// ==================================================
// MQTT PUBLISH FUNCTIONS
// ==================================================
void publishSlotState(int index) {
  if (!mqttClient.connected()) return;

  char topic[64];
  char payload[48];

  snprintf(topic, sizeof(topic), "parking/slots/%s/state", SLOT_IDS[index]);
  snprintf(
    payload,
    sizeof(payload),
    "{\"occupied\":%s}",
    occupied[index] ? "true" : "false"
  );

  // Retain slot state so the backend can recover it after reconnecting.
  mqttClient.publish(topic, payload, true);
  previousOccupied[index] = occupied[index];

  Serial.print("MQTT slot: ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(payload);
}

void publishAllSlotStates() {
  for (int i = 0; i < 4; i++) {
    publishSlotState(i);
  }

  slotStatusPublished = true;
}

void publishGateEvent(const char* gateId, const char* event) {
  if (!mqttClient.connected()) return;

  char topic[64];
  char payload[96];

  snprintf(topic, sizeof(topic), "parking/gates/%s/event", gateId);
  snprintf(
    payload,
    sizeof(payload),
    "{\"event\":\"%s\",\"triggeredBy\":\"MQTT_SENSOR\"}",
    event
  );

  // Gate messages are events, not retained state. Retaining them would
  // replay old events and create duplicate gate-log rows on reconnect.
  mqttClient.publish(topic, payload, false);

  Serial.print("MQTT gate: ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(payload);
}

// ==================================================
// WI-FI CONNECTION
// ==================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  Serial.println();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWiFiAttempt = millis();
}

// ==================================================
// MQTT CONNECTION
// ==================================================
void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) {
    return;
  }

  unsigned long now = millis();

  if (now - lastMQTTAttempt < MQTT_RETRY_INTERVAL) {
    return;
  }

  lastMQTTAttempt = now;

  Serial.println("Connecting to MQTT broker...");

  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    Serial.println("MQTT broker connected!");

    // Sync the current state of all four sensors. Gate events are only
    // published when the gates actually open or close.
    publishAllSlotStates();
  } else {
    Serial.print("MQTT connection failed. State: ");
    Serial.println(mqttClient.state());
  }
}

// ==================================================
// SETUP
// ==================================================
void setup() {
  Serial.begin(115200);

  // Parking slot IR sensors
  for (int i = 0; i < 4; i++) {
    pinMode(slotIR[i], INPUT_PULLUP);
  }

  // Entry and exit IR sensors
  pinMode(entryIR, INPUT_PULLUP);
  pinMode(exitIR, INPUT_PULLUP);

  // LEDs
  pinMode(greenLED, OUTPUT);
  pinMode(redLED, OUTPUT);
  digitalWrite(greenLED, LOW);
  digitalWrite(redLED, LOW);

  // Servo motors
  entryServo.setPeriodHertz(50);
  exitServo.setPeriodHertz(50);

  entryServo.attach(entryServoPin, 500, 2400);
  exitServo.attach(exitServoPin, 500, 2400);

  // Close both gates at startup
  entryServo.write(ENTRY_GATE_CLOSED);
  exitServo.write(EXIT_GATE_CLOSED);

  // LCD
  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("SMART PARKING");
  lcd.setCursor(0, 1);
  lcd.print("Dashboard mode");
  delay(1500);
  lcd.clear();

  // MQTT broker configuration
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(5);

  Serial.println("================================");
  Serial.println("SMART PARKING - DASHBOARD MODE");
  Serial.println("================================");
  Serial.println("Slot mappings:");
  for (int i = 0; i < 4; i++) {
    Serial.print("  P");
    Serial.print(i + 1);
    Serial.print(" -> ");
    Serial.println(SLOT_IDS[i]);
  }
  Serial.print("Entry gate: ");
  Serial.println(ENTRY_GATE_ID);
  Serial.print("Exit gate: ");
  Serial.println(EXIT_GATE_ID);
  Serial.println("Slot IR sensors: GPIO 18, 19, 21, 22");
  Serial.println("Entry IR sensor 5: GPIO 23");
  Serial.println("Exit IR sensor 6: GPIO 25");
  Serial.println("Entry servo: GPIO 26");
  Serial.println("Exit servo: GPIO 27");
  Serial.println("Gate closing delay: 3 seconds");
  Serial.print("MQTT Broker: ");
  Serial.println(MQTT_SERVER);
  Serial.print("MQTT Port: ");
  Serial.println(MQTT_PORT);

  connectWiFi();
}

// ==================================================
// MAIN LOOP
// ==================================================
void loop() {
  unsigned long now = millis();

  // ------------------------------------------------
  // 1. WI-FI STATUS AND RECONNECTION
  // ------------------------------------------------
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;

      Serial.println();
      Serial.println("Wi-Fi connected!");
      Serial.print("ESP32 IP Address: ");
      Serial.println(WiFi.localIP());
      Serial.print("MQTT Broker IP: ");
      Serial.println(MQTT_SERVER);
    }

    // ------------------------------------------------
    // 2. MQTT CONNECTION AND CLIENT LOOP
    // ------------------------------------------------
    if (!mqttClient.connected()) {
      reconnectMQTT();
    } else {
      mqttClient.loop();
    }
  } else {
    if (wifiWasConnected) {
      wifiWasConnected = false;
      Serial.println("Wi-Fi disconnected!");
    }

    // WiFi.begin() is only called once at startup.
    // Use reconnect() for later attempts to avoid repeatedly
    // restarting an active connection attempt.
    if (now - lastWiFiAttempt >= WIFI_RETRY_INTERVAL) {
      lastWiFiAttempt = now;
      Serial.println("Attempting Wi-Fi reconnection...");
      WiFi.reconnect();
    }
  }

  // ------------------------------------------------
  // 3. READ THE FOUR PARKING SLOT SENSORS
  // ------------------------------------------------
  int occupiedCount = 0;

  for (int i = 0; i < 4; i++) {
    occupied[i] = (digitalRead(slotIR[i]) == IR_DETECTED);

    if (occupied[i]) {
      occupiedCount++;
    }
  }

  int availableCount = 4 - occupiedCount;
  bool parkingFull = (occupiedCount == 4);

  // ------------------------------------------------
  // 4. CONTROL PARKING STATUS LEDS
  // ------------------------------------------------
  digitalWrite(greenLED, parkingFull ? LOW : HIGH);
  digitalWrite(redLED, parkingFull ? HIGH : LOW);

  // ------------------------------------------------
  // 5. PUBLISH PARKING SLOT CHANGES THROUGH MQTT
  // ------------------------------------------------
  if (mqttClient.connected()) {
    bool statePublished = false;

    for (int i = 0; i < 4; i++) {
      if (!slotStatusPublished || occupied[i] != previousOccupied[i]) {
        publishSlotState(i);
        statePublished = true;
      }
    }

    if (statePublished) {
      slotStatusPublished = true;
      Serial.println("MQTT: parking slot state updated");
    }
  }

  // ------------------------------------------------
  // 6. READ ENTRY AND EXIT SENSORS
  // ------------------------------------------------
  bool entryVehicleDetected = (digitalRead(entryIR) == IR_DETECTED);
  bool exitVehicleDetected = (digitalRead(exitIR) == IR_DETECTED);

  // ------------------------------------------------
  // 7. ENTRY GATE CONTROL
  // IR sensor 5 controls only the entry servo.
  // ------------------------------------------------
  if (entryVehicleDetected && !parkingFull) {
    if (!entryGateOpen) {
      entryServo.write(ENTRY_GATE_OPEN);
      entryGateOpen = true;

      Serial.println("Entry vehicle detected");
      Serial.println("ENTRY GATE OPEN");

      publishGateEvent(ENTRY_GATE_ID, "OPENED");
    }

    entryLastDetectionTime = now;
  }

  // Close entry gate 3 seconds after detection stops.
  if (entryGateOpen &&
      !entryVehicleDetected &&
      (now - entryLastDetectionTime >= GATE_CLOSE_DELAY)) {
    entryServo.write(ENTRY_GATE_CLOSED);
    entryGateOpen = false;

    Serial.println("ENTRY GATE CLOSED");
    publishGateEvent(ENTRY_GATE_ID, "CLOSED");
  }

  // ------------------------------------------------
  // 8. EXIT GATE CONTROL
  // IR sensor 6 controls only the exit servo.
  // ------------------------------------------------
  if (exitVehicleDetected) {
    if (!exitGateOpen) {
      exitServo.write(EXIT_GATE_OPEN);
      exitGateOpen = true;

      Serial.println("Exit vehicle detected");
      Serial.println("EXIT GATE OPEN");

      publishGateEvent(EXIT_GATE_ID, "OPENED");
    }

    exitLastDetectionTime = now;
  }

  // Close exit gate 3 seconds after detection stops.
  if (exitGateOpen &&
      !exitVehicleDetected &&
      (now - exitLastDetectionTime >= GATE_CLOSE_DELAY)) {
    exitServo.write(EXIT_GATE_CLOSED);
    exitGateOpen = false;

    Serial.println("EXIT GATE CLOSED");
    publishGateEvent(EXIT_GATE_ID, "CLOSED");
  }

  // ------------------------------------------------
  // 9. UPDATE LCD EVERY 500 MILLISECONDS
  // ------------------------------------------------
  now = millis();

  if (now - lastLCDUpdate >= LCD_INTERVAL) {
    lastLCDUpdate = now;

    // First row: parking slots 1 and 2
    lcd.setCursor(0, 0);
    lcd.print("S1:");
    lcd.print(occupied[0] ? "FULL " : "EMPTY");
    lcd.print("S2:");
    lcd.print(occupied[1] ? "FULL " : "EMPTY");

    // Second row: parking slots 3 and 4
    lcd.setCursor(0, 1);
    lcd.print("S3:");
    lcd.print(occupied[2] ? "FULL " : "EMPTY");
    lcd.print("S4:");
    lcd.print(occupied[3] ? "FULL " : "EMPTY");

    // Serial Monitor parking information
    Serial.print("Occupied: ");
    Serial.print(occupiedCount);
    Serial.print("/4 | Available: ");
    Serial.println(availableCount);
  }

  // Small pause keeps the loop responsive without busy-spinning.
  delay(10);
}
