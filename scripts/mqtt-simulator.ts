import "./load-env";

import mqtt from "mqtt";

const url = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const once = process.argv.includes("--once");
const intervalMs = Number(process.env.MQTT_SIM_INTERVAL ?? 4_000);

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publish(
  client: mqtt.MqttClient,
  topic: string,
  payload: unknown,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 0 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  console.log(`[sim] ${topic} ${JSON.stringify(payload)}`);
}

async function endClient(client: mqtt.MqttClient): Promise<void> {
  await new Promise<void>((resolve) => {
    client.end(false, {}, () => resolve());
  });
}

async function main() {
  console.log(`[sim] Connecting to ${url}…`);
  const client = mqtt.connect(url, {
    clientId: `hk-parking-sim-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 3_000,
    connectTimeout: 10_000,
  });

  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("error", reject);
  });

  console.log("[sim] Connected. Publishing demo sensor events…");

  const publishCycle = async () => {
    const slotNumber = randomInt(1, 24);
    const slotId = `SLOT-${String(slotNumber).padStart(3, "0")}`;
    const occupied = Math.random() > 0.45;

    await publish(client, `parking/slots/${slotId}/state`, {
      occupied,
      ts: new Date().toISOString(),
    });

    if (Math.random() > 0.35) {
      const gateId = Math.random() > 0.5 ? "GATE-IN-01" : "GATE-OUT-01";
      const unauthorized = Math.random() > 0.92;

      await publish(client, `parking/gates/${gateId}/event`, {
        event: unauthorized ? "UNAUTHORIZED_ATTEMPT" : "OPENED",
        triggeredBy: unauthorized
          ? "MQTT_SENSOR"
          : Math.random() > 0.5
            ? "RFID"
            : "MQTT_SENSOR",
        ts: new Date().toISOString(),
      });

      if (!unauthorized) {
        await delay(1_200);
        await publish(client, `parking/gates/${gateId}/event`, {
          event: "CLOSED",
          triggeredBy: "MQTT_SENSOR",
          ts: new Date().toISOString(),
        });
      }
    }
  };

  if (once) {
    await publishCycle();
    await endClient(client);
    console.log("[sim] Published one cycle. Exiting.");
    return;
  }

  let running = true;

  const shutdown = async () => {
    if (!running) return;
    running = false;
    console.log("\n[sim] Stopping simulator…");
    await endClient(client);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  while (running) {
    try {
      await publishCycle();
    } catch (error) {
      console.error("[sim] Publish failed:", error);
    }

    await delay(intervalMs);
  }
}

main().catch((error) => {
  console.error("[sim] Fatal error:", error);
  process.exit(1);
});
