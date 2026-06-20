/**
 * Bambu Labs printer integration — send 3MF directly to a Bambu A1 over the local network.
 * Uses the printer's built-in FTP (port 990, FTPS) to upload the file and MQTT (port 8883)
 * to start the print job. No new dependencies: uses Node's built-in TLS + net.
 *
 * Required env vars:
 *   BAMBU_PRINTER_IP   — local IP of the printer (e.g. "192.168.1.42")
 *   BAMBU_ACCESS_CODE  — 8-char access code from the printer's LCD (Settings → Network → Access Code)
 *   BAMBU_SERIAL       — printer serial number (Settings → Device Info)
 *
 * The printer must be on the same LAN. Cloud API fallback (BAMBU_CLOUD_TOKEN) is a future phase.
 */
import * as tls from "node:tls";
import * as net from "node:net";

const BAMBU_IP = () => process.env.BAMBU_PRINTER_IP || "";
const BAMBU_CODE = () => process.env.BAMBU_ACCESS_CODE || "";
const BAMBU_SERIAL = () => process.env.BAMBU_SERIAL || "";
const FTP_PORT = 990;
const MQTT_PORT = 8883;

export function bambuConfigured(): boolean {
  return !!(BAMBU_IP() && BAMBU_CODE() && BAMBU_SERIAL());
}

/** Check if the Bambu printer is reachable on the local network (quick TCP probe). */
export function bambuReachable(timeoutMs = 2000): Promise<boolean> {
  if (!bambuConfigured()) return Promise.resolve(false);
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: BAMBU_IP(), port: MQTT_PORT });
    let done = false;
    const end = (v: boolean) => { if (!done) { done = true; clearTimeout(t); try { sock.destroy(); } catch {} resolve(v); } };
    const t = setTimeout(() => end(false), timeoutMs);
    sock.on("connect", () => end(true));
    sock.on("error", () => end(false));
  });
}

/** Upload a 3MF file to the printer via FTPS (port 990, implicit TLS). */
async function ftpsUpload(filename: string, data: Buffer, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("FTPS upload timeout")), timeoutMs);

    const sock = tls.connect({
      host: BAMBU_IP(),
      port: FTP_PORT,
      rejectUnauthorized: false,
    }, () => {
      let buf = "";
      let state: "wait_welcome" | "wait_user" | "wait_pass" | "wait_type" | "wait_pasv" | "wait_stor" | "done" = "wait_welcome";
      let dataPort = 0;

      sock.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        const lines = buf.split("\r\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          const code = parseInt(line.substring(0, 3), 10);

          switch (state) {
            case "wait_welcome":
              if (code === 220) { sock.write("USER bblp\r\n"); state = "wait_user"; }
              break;
            case "wait_user":
              if (code === 331) { sock.write(`PASS ${BAMBU_CODE()}\r\n`); state = "wait_pass"; }
              break;
            case "wait_pass":
              if (code === 230) { sock.write("TYPE I\r\n"); state = "wait_type"; }
              else if (code === 530) { clearTimeout(timer); reject(new Error("Bambu FTP login failed — check BAMBU_ACCESS_CODE")); sock.destroy(); }
              break;
            case "wait_type":
              if (code === 200) { sock.write("PASV\r\n"); state = "wait_pasv"; }
              break;
            case "wait_pasv": {
              if (code === 227) {
                const m = line.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
                if (m) {
                  dataPort = parseInt(m[5]) * 256 + parseInt(m[6]);
                  sock.write(`STOR /sdcard/${filename}\r\n`);
                  state = "wait_stor";
                }
              }
              break;
            }
            case "wait_stor":
              if (code === 150 || code === 125) {
                const dataSock = tls.connect({
                  host: BAMBU_IP(),
                  port: dataPort,
                  rejectUnauthorized: false,
                }, () => {
                  dataSock.write(data, () => {
                    dataSock.end();
                  });
                });
                dataSock.on("close", () => { state = "done"; });
                dataSock.on("error", (err) => { clearTimeout(timer); reject(err); sock.destroy(); });
              }
              break;
            case "done":
              if (code === 226) {
                sock.write("QUIT\r\n");
                clearTimeout(timer);
                resolve();
                sock.destroy();
              }
              break;
          }
        }
      });
    });

    sock.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

/** Send an MQTT command to start printing the uploaded file. */
async function mqttPrint(filename: string, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("MQTT print command timeout")), timeoutMs);
    const serial = BAMBU_SERIAL();

    const sock = tls.connect({
      host: BAMBU_IP(),
      port: MQTT_PORT,
      rejectUnauthorized: false,
    }, () => {
      // MQTT CONNECT packet
      const clientId = `claude_hw_${Date.now().toString(36)}`;
      const username = "bblp";
      const password = BAMBU_CODE();

      const clientIdBuf = Buffer.from(clientId, "utf8");
      const userBuf = Buffer.from(username, "utf8");
      const passBuf = Buffer.from(password, "utf8");

      // Variable header: protocol name "MQTT", level 4, flags (user+pass+clean), keepalive 60
      const varHeader = Buffer.from([
        0x00, 0x04, 0x4D, 0x51, 0x54, 0x54, // "MQTT"
        0x04,                                  // protocol level 4
        0xC2,                                  // connect flags: user+pass+clean
        0x00, 0x3C,                            // keepalive 60s
      ]);

      const payload = Buffer.concat([
        Buffer.from([0x00, clientIdBuf.length]), clientIdBuf,
        Buffer.from([0x00, userBuf.length]), userBuf,
        Buffer.from([0x00, passBuf.length]), passBuf,
      ]);

      const remaining = varHeader.length + payload.length;
      const connectPacket = Buffer.concat([
        Buffer.from([0x10]),
        encodeRemainingLength(remaining),
        varHeader,
        payload,
      ]);

      sock.write(connectPacket);

      sock.once("data", () => {
        // Got CONNACK — now publish the print command
        const topic = `device/${serial}/request`;
        const message = JSON.stringify({
          print: {
            sequence_id: String(Date.now()),
            command: "project_file",
            param: `Metadata/plate_1.gcode`,
            subtask_name: filename.replace(".3mf", ""),
            url: `ftp://${filename}`,
            bed_type: "auto",
            timelapse: false,
            bed_leveling: true,
            flow_cali: true,
            vibration_cali: true,
            layer_inspect: false,
            use_ams: false,
          },
        });

        const topicBuf = Buffer.from(topic, "utf8");
        const msgBuf = Buffer.from(message, "utf8");
        const pubPayload = Buffer.concat([
          Buffer.from([0x00, topicBuf.length]), topicBuf,
          msgBuf,
        ]);
        const pubRemaining = pubPayload.length;
        const publishPacket = Buffer.concat([
          Buffer.from([0x30]),
          encodeRemainingLength(pubRemaining),
          pubPayload,
        ]);

        sock.write(publishPacket, () => {
          clearTimeout(timer);
          sock.destroy();
          resolve();
        });
      });
    });

    sock.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

/** Encode MQTT remaining length (variable-length encoding). */
function encodeRemainingLength(len: number): Buffer {
  const bytes: number[] = [];
  do {
    let b = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) b |= 0x80;
    bytes.push(b);
  } while (len > 0);
  return Buffer.from(bytes);
}

/**
 * Send a 3MF file directly to the Bambu printer and start printing.
 * 1. Upload via FTPS to /sdcard/
 * 2. Send MQTT print command
 * Returns the filename used on the printer.
 */
export async function sendToPrinter(
  data: Buffer,
  modelName: string,
  timeoutMs = 60_000,
): Promise<{ filename: string; status: string }> {
  if (!bambuConfigured()) throw new Error("Bambu printer not configured — set BAMBU_PRINTER_IP, BAMBU_ACCESS_CODE, BAMBU_SERIAL");

  const filename = `claude_${modelName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${Date.now().toString(36)}.3mf`;

  await ftpsUpload(filename, data, timeoutMs);
  await mqttPrint(filename, 10_000);

  return { filename, status: "print_started" };
}
