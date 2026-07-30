import { mkdir, writeFile } from "node:fs/promises";

const start = "2026-07-04T16:06:28.828000+00:00";
const end = "2026-07-04T16:07:56.939000+00:00";
const base = "https://api.openf1.org/v1";
const query =
  "session_key=11322&driver_number=12" +
  `&date%3E=${encodeURIComponent(start)}` +
  `&date%3C=${encodeURIComponent(end)}`;

const [carResponse, locationResponse] = await Promise.all([
  fetch(`${base}/car_data?${query}`),
  fetch(`${base}/location?${query}`),
]);

if (!carResponse.ok || !locationResponse.ok) {
  throw new Error(
    `OpenF1 request failed: car=${carResponse.status}, location=${locationResponse.status}`,
  );
}

const [rawCar, rawLocation] = await Promise.all([
  carResponse.json(),
  locationResponse.json(),
]);

const epoch = new Date(start).getTime();
const elapsed = (date) => Math.max(0, new Date(date).getTime() - epoch);

const data = {
  source: {
    name: "OpenF1",
    url: "https://openf1.org/",
    sessionKey: 11322,
    meetingKey: 1289,
    driver: "Kimi Antonelli",
    driverNumber: 12,
    lap: 18,
    lapDurationMs: 88111,
    startedAt: start,
    endedAt: end,
    replayRate: 4,
    note:
      "Speed, RPM, gear, throttle, brake, and position are recorded OpenF1 channels. Curvature, steering, lateral load, and brake temperature are derived for the visualization.",
  },
  car: rawCar.map((sample) => ({
    t: elapsed(sample.date),
    speed: sample.speed,
    rpm: sample.rpm,
    gear: sample.n_gear,
    throttle: sample.throttle,
    brake: sample.brake,
    drs: sample.drs,
  })),
  location: rawLocation.map((sample) => ({
    t: elapsed(sample.date),
    x: sample.x,
    y: sample.y,
    z: sample.z,
  })),
};

await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/silverstone-antonelli-l18.json",
  `${JSON.stringify(data)}\n`,
);

console.log(
  `Wrote ${data.car.length} car samples and ${data.location.length} position samples.`,
);
