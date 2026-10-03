#!/bin/sh
# Postiz's shared preview player (VideoOrImage) renders <video muted loop> with no
# controls, so post previews can never play sound. Add native controls (autoplay
# stays muted, as browsers require) so a preview can be unmuted and scrubbed.
# Older scheduled posts reference media at host.docker.internal:4007 (reachable by
# the publish worker, not by the browser), so the preview loads the same file from
# MAIN_URL, the address the browser uses.
# Runs at container start; each edit is a no-op once applied or when the compiled
# pattern isn't present.
NEXT_DIR=/app/apps/frontend/.next
BROWSER_URL=${MAIN_URL:-http://localhost:4007}
for f in $(grep -rl 'muted:!0,loop:!0' "$NEXT_DIR" 2>/dev/null); do
  sed -i 's/muted:!0,loop:!0/muted:!0,controls:!0,loop:!0/' "$f"
  echo "preview player: enabled controls in ${f#$NEXT_DIR/}"
done
VIDEO_SRC='\("video",\{src:([a-zA-Z_$]+),autoPlay:'
BROWSER_SRC='("video",{src:\1?.replace("http://host.docker.internal:4007","'"${BROWSER_URL%/}"'"),autoPlay:'
for f in $(grep -rlE "$VIDEO_SRC" "$NEXT_DIR" 2>/dev/null); do
  sed -i -E "s|${VIDEO_SRC}|${BROWSER_SRC}|" "$f"
  echo "preview player: browser-reachable media URL in ${f#$NEXT_DIR/}"
done
