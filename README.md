
## Watch the Tutorial for docker-compose install:
[https://m.youtube.com/watch?v=A6CjAmJOWvA&t=5s](https://m.youtube.com/watch?v=A6CjAmJOWvA&t=5s)

## Warning
If you are upgrading from Postiz old version, please make sure you update your docker compose, you can read more here:
https://docs.postiz.com/installation/migration

### Configuration uses environment variables

The docker containers for Postiz are entirely configured with environment variables.

- **Option A** - environment variables in your `docker-compose.yml` file
- **Option B** - environment variables in a `postiz.env` file mounted in `/config` for the Postiz container only
- **Option C** - environment variables in a `.env` file next to your `docker-compose.yml` file (not recommended).

... or a mixture of the above options!

There is a [configuration reference](https://docs.postiz.com/configuration/reference) page with a list
of configuration settings.

Setup:
```
git clone https://github.com/gitroomhq/postiz-docker-compose
cd postiz-docker-compose
cp postiz.env.example postiz.env
```

Fill `postiz.env` with a unique JWT secret, `FRONTEND_URL`, `MAIN_URL` and `NEXT_PUBLIC_BACKEND_URL` (the public address below), and the credentials for the social providers you want to connect. Put the Cloudflare tunnel token in `cloudflared.env` as `TUNNEL_TOKEN=...`.

Then run:
```
docker compose up
```

Wait for it to load:

Open your website at your public address (`MAIN_URL` in `postiz.env`).

### Public address

`postiz-tunnel`, a Cloudflare named tunnel, publishes Postiz at a permanent https address on your own domain. Use a random subdomain, and keep it in `postiz.env` rather than in this public repo. The tunnel's route (`<public host>` → `http://postiz:5000`) is set on the `postiz` tunnel in the Cloudflare dashboard (Zero Trust → Networks → Tunnels & Mesh). Its token is `TUNNEL_TOKEN` in `cloudflared.env`, which is gitignored and kept out of the Postiz container. `MAIN_URL`, `NEXT_PUBLIC_BACKEND_URL` and `FRONTEND_URL` in `postiz.env` all use this address, so the browser, OAuth callbacks and platforms that download media (Instagram) share one permanent URL. Registration is disabled because the site is reachable from the internet. Port 4007 stays published for local scripts, for example the public API at `http://localhost:4007/api/public/v1`.

Register `<MAIN_URL>/integrations/social/<provider>` as the OAuth callback with each provider (`youtube`, `facebook`, `instagram-standalone`, `linkedin`, `linkedin-page`).

### Instagram media

Instagram downloads Reels and images from a public HTTPS URL. When a post publishes, `overrides/instagram/instagram.provider.js` rewrites local upload URLs (`host.docker.internal`, `localhost`, or an old ngrok host) to `MAIN_URL`. The override is a copy of the bundled Postiz file plus that hook; re-copy it from the image if you upgrade Postiz.

### Facebook and Pinterest media

Facebook and Pinterest also download media from the URL they're given. `overrides/facebook/facebook.provider.js` and `overrides/pinterest/pinterest.provider.js` read local uploads from the uploads volume and send the bytes instead: multipart `source` to Facebook, base64 images and covers to Pinterest. A Pinterest video pin needs a cover image as its second media item. Pinterest isn't scheduled at the moment, because the app only has Trial API access. As with Instagram, re-copy these from the image if you upgrade Postiz.

### Channel avatars and token refresh

On every token refresh, Postiz re-saves the channel avatar through `LocalStorage.uploadSimple`, which downloads it again. If that download failed, the refresh failed and the channel was flagged for setup. `overrides/local-storage/local.storage.js` reuses files that are already in the uploads volume, returns URLs under `MAIN_URL`, and keeps the old URL instead of throwing.

### Preview player with sound

Postiz's post preview plays videos muted with no controls. `overrides/preview-player/patch-preview-player.sh` runs at container start (see the `postiz` service `command`) and adds native player controls, so a preview can be unmuted. Autoplay stays muted because browsers block autoplay with sound. Older scheduled posts reference media at `host.docker.internal:4007`, which only the publish worker can reach, so the patch makes previews load those files from `MAIN_URL`.
