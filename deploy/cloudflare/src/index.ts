// Cloudflare Worker in front of the Fastify API container (issue #43).
//
// Every request, HTTP and WebSocket upgrade alike, goes to ONE Durable Object named "api", and that
// Durable Object owns the only container. Sessions live in the container's memory, so there must be
// exactly one. With scheduling_policy "durable_object" there is no max_instances: the fixed name is
// what guarantees a single instance.
import { DurableObject } from "cloudflare:workers";

interface Env {
  API: DurableObjectNamespace<ApiContainer>;
  // vars (wrangler.jsonc)
  PIPELINE_MODE?: string;
  TRUST_PROXY?: string;
  MIN_CAPTURE_CONFIDENCE?: string;
  DEBUG_TRANSCRIPTS?: string;
  // secrets (wrangler secret put)
  JEV_API_KEY?: string;
  EXA_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  DEMO_JOIN_CODE?: string;
  DEMO_JOIN_EXPIRES_AT?: string;
  ALLOWED_ORIGINS?: string;
}

const INSTANCE_NAME = "api";
const PORT = 8080;
// How long the container keeps running after the Durable Object goes idle. 6 h is the documented maximum.
// An open WebSocket keeps the Durable Object active, so the container stays up for the whole session.
const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const READY_TIMEOUT_MS = 90_000;
// Copied from the Worker env into the container env. Values are never logged.
const PASSTHROUGH = [
  "PIPELINE_MODE",
  "TRUST_PROXY",
  "MIN_CAPTURE_CONFIDENCE",
  "DEBUG_TRANSCRIPTS",
  "JEV_API_KEY",
  "EXA_API_KEY",
  "DEEPGRAM_API_KEY",
  "DEMO_JOIN_CODE",
  "DEMO_JOIN_EXPIRES_AT",
  "ALLOWED_ORIGINS",
] as const;

export class ApiContainer extends DurableObject<Env> {
  private ready = false;
  private starting: Promise<void> | undefined;
  private monitoring: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // After a Durable Object reset (deploy, runtime update) the container can still be running.
    // A reset clears the inactivity timeout and the exit monitor, so re-arm both.
    if (ctx.container?.running) {
      const container = ctx.container;
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
      this.observeExit();
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (!this.ready) {
      this.starting ??= this.ensureReady().finally(() => {
        this.starting = undefined;
      });
      try {
        await this.starting;
      } catch (error) {
        console.error("container not ready", error instanceof Error ? error.message : String(error));
        return Response.json({ error: "backend_unavailable" }, { status: 503, headers: { "retry-after": "5" } });
      }
    }

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    // Same method, body and headers, including Upgrade, Authorization, Origin and Sec-WebSocket-Protocol.
    const forwarded = new Request(url, request);
    // Return the port response as-is so a 101 upgrade (with the chosen subprotocol) reaches the client.
    return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
  }

  private containerEnv(): Record<string, string> {
    const env: Record<string, string> = { HOST: "0.0.0.0", PORT: String(PORT) };
    for (const name of PASSTHROUGH) {
      const value = this.env[name];
      if (typeof value === "string" && value !== "") env[name] = value;
    }
    return env;
  }

  private async ensureReady(): Promise<void> {
    const container = this.ctx.container!;
    const image = container.images.api;
    if (!image) throw new Error("ctx.container.images.api is not configured");
    const env = this.containerEnv();
    const cfg = await sha256Hex(JSON.stringify(Object.entries(env).sort(([a], [b]) => a.localeCompare(b))));

    // Deploys do not restart a running container, and a running process keeps its startup env.
    // Replace it when the image or the vars/secrets changed. inspect() reports image "" while starting.
    const info = await container.inspect();
    if (info && info.image !== "" && (info.image !== image || info.labels?.cfg !== cfg)) {
      console.log("replacing container: image or config changed");
      await container.destroy("image or config changed");
      // Let the old exit monitor settle so it cannot clear `ready` for the new container.
      if (this.monitoring) await this.monitoring;
    }

    if (!container.running) {
      console.log("starting container");
      container.start({ image, instance: "standard-1", enableInternet: true, env, labels: { cfg } });
    }
    this.observeExit();
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

    // running only means start was requested. Wait until the server answers /health.
    const port = container.getTcpPort(PORT);
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let lastError = "no response";
    while (Date.now() < deadline) {
      try {
        const res = await port.fetch("http://container/health", { signal: AbortSignal.timeout(2000) });
        await res.body?.cancel();
        if (res.ok) {
          this.ready = true;
          return;
        }
        lastError = `health returned ${res.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      if (!container.running) throw new Error(`container exited during startup (check secrets and logs): ${lastError}`);
      await scheduler.wait(250);
    }
    throw new Error(`container did not answer /health on port ${PORT}: ${lastError}`);
  }

  private observeExit(): void {
    if (this.monitoring) return;
    this.monitoring = this.ctx
      .container!.monitor()
      .then(() => console.log("container exited"))
      .catch((error: unknown) => console.error("container failed", error instanceof Error ? error.message : String(error)))
      .finally(() => {
        this.monitoring = undefined;
        this.ready = false;
      });
    this.ctx.waitUntil(this.monitoring);
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // The server (TRUST_PROXY=1) takes the right-most X-Forwarded-For entry as the client IP for its
    // join rate limit. Replace whatever the client sent with Cloudflare's view of the client.
    const headers = new Headers(request.headers);
    headers.delete("x-real-ip");
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-forwarded-for", clientIp);
    else headers.delete("x-forwarded-for");
    return env.API.getByName(INSTANCE_NAME).fetch(new Request(request, { headers }));
  },
} satisfies ExportedHandler<Env>;
