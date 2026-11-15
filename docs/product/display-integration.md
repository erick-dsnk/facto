# Meta glasses web display deployment

The web display is built into the API image and served from the API's own origin at `/display/`. This keeps the companion app, the UI, and the read-only display stream on one HTTPS host.

## Build and deploy

Build the container from the repository root so Docker receives the glasses workspace files:

```sh
docker build -t facto-glasses-api .
```

The image runs `npm run build:glasses` during its build. The generated Vite files go to `dist/glasses`, which the API exposes at `/display/` and `/display/assets/<generated-file>`. Route HTTP requests and WebSocket upgrades for the same public host to this API container. Keep TLS enabled at the public edge.

Configure the API's `ALLOWED_ORIGINS` with the exact origin from which the glasses UI is opened, for example `https://glasses.example.com` (scheme and host, with no path). Set it explicitly in deployed environments; the development defaults permit only localhost origins. For additional trusted web origins, use a comma-separated list of exact origins. Do not use `*`.

Configure `DEMO_JOIN_CODE` and a future `DEMO_JOIN_EXPIRES_AT` in every deployment; the companion uses them to create owner sessions in fixture and live modes. Live checks also require server-side `JEV_API_KEY` and `EXA_API_KEY`; live speech recognition requires `DEEPGRAM_API_KEY`. Keep these values in the deployment secret store. See [the cloud handoff](../cloud-handoff.md) for the existing API deployment workflow.

Check `/health`, then open `https://glasses.example.com/display/`. A missing build returns `display_not_built`; the Docker image builds it as part of packaging. The simulator and a regular browser can preview the display route, but simulator success does not establish compatibility on physical glasses.

## Connect the iPhone companion

In Glasses Lab, set **Backend URL** to the public API origin, enter the join code, then connect. Under **Glasses display**, choose **Web display**. The app fills the web-app URL with `<backend-origin>/display/`; this URL can be changed if the UI is hosted elsewhere over HTTPS. Create the temporary display link and share it to the Meta Web Apps launcher on the glasses.

The companion remains the session owner and handles wake detection, camera capture, microphone input, and spoken output. The web app receives a separate, read-only display grant. It expires after at most five minutes and is tied to the current companion session; create a new link after it expires, after reconnecting, or after a session renewal. Choosing native display revokes the web reader before sending cards through the native display path.

The generated link contains a short-lived display credential in its URL fragment. Treat it like a temporary access link: share it only with the intended glasses session and do not put it in logs or screenshots.

For local development, run `npm run build:glasses`, then `npm run dev`, and use `http://localhost:3000/display/` with a local companion backend. Non-local companion URLs and Meta Web Apps require HTTPS.
