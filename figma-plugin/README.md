# DS Validation — Figma plugin

Sends a file's local variables to the DS Validation web app so the audit can run
the primitive-token check. Variables REST access is Enterprise-only, so this
plugin is the main path for everyone else.

## How it works (pairing flow)

1. In the web app, start a new audit and choose **Figma plugin** as the variable
   source. The setup page shows a short-lived **pairing code**.
2. Open this plugin in the same Figma file.
3. Enter the pairing code and click **Send variables**. The plugin POSTs the
   file's local variables (and the file key) to `POST /api/variable-uploads`.
4. The server validates the code (single-use, 10-min expiry) and that the file
   key matches the audit, then attaches the variables. The web page detects the
   upload and continues automatically.

The target app URL is `networkAccess.allowedDomains` in
[manifest.json](manifest.json) (with `devAllowedDomains` for `localhost:3000`).
It can be overridden under **Advanced** in the plugin UI for staging/preview —
but the chosen URL must be listed in `allowedDomains`, or Figma blocks the fetch.

## Local development

1. Run the web app (`npm run dev` → http://localhost:3000).
2. In Figma: **Plugins → Development → Import plugin from manifest…** and select
   this folder's `manifest.json`.
3. `devAllowedDomains` permits the `localhost:3000` upload while developing.

## Publishing (manual follow-up)

To remove the manual import step for end users, publish to the Figma Community:
**Plugins → Development → Publish**. Set `allowedDomains` to the production app
domain before publishing. Until then, share the "import from manifest"
instructions above.
