#!/usr/bin/env bash
set -Eeuo pipefail
: "${LABEL_STUDIO_IMAGE:?Immutable image reference required}"
: "${EXPECTED_COMMIT:?Expected commit required}"
DEPLOY_DIR="${LABEL_STUDIO_DEPLOY_DIR:-/docker/label-studio}"
mkdir -p "$DEPLOY_DIR"
exec 9>"$DEPLOY_DIR/deploy.lock"
flock -n 9 || { echo 'Another Label Studio deployment is running.' >&2; exit 1; }
case "$LABEL_STUDIO_IMAGE" in ghcr.io/remb0/label-studio@sha256:*) ;; *) echo 'Only immutable Label Studio GHCR images are accepted.' >&2; exit 1;; esac
previous_image=$(docker inspect label-studio --format '{{.Config.Image}}' 2>/dev/null || true)
cp compose.yaml "$DEPLOY_DIR/compose.yaml"
docker pull "$LABEL_STUDIO_IMAGE"
export LABEL_STUDIO_BIND="${LABEL_STUDIO_BIND:-192.168.0.13}"
export LABEL_STUDIO_PORT="${LABEL_STUDIO_PORT:-3022}"
rollback() {
  echo 'Health/version verification failed; restoring previous image.' >&2
  if [[ -n "$previous_image" ]]; then
    LABEL_STUDIO_IMAGE="$previous_image" docker compose --project-directory "$DEPLOY_DIR" up -d --no-build --pull never label-studio
  else
    docker compose --project-directory "$DEPLOY_DIR" stop label-studio
  fi
}
trap rollback ERR
docker compose --project-directory "$DEPLOY_DIR" up -d --no-build --pull never label-studio
for attempt in $(seq 1 30); do
  if curl -fsS "http://$LABEL_STUDIO_BIND:$LABEL_STUDIO_PORT/health" >/dev/null; then break; fi
  sleep 1
done
curl -fsS "http://$LABEL_STUDIO_BIND:$LABEL_STUDIO_PORT/health" >/dev/null
actual_commit=$(curl -fsS "http://$LABEL_STUDIO_BIND:$LABEL_STUDIO_PORT/version.json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["commit"])')
[[ "$actual_commit" == "$EXPECTED_COMMIT" ]]
printf '%s\n' "$EXPECTED_COMMIT" > "$DEPLOY_DIR/.deployed-commit"
printf '%s\n' "$LABEL_STUDIO_IMAGE" > "$DEPLOY_DIR/.deployed-image"
trap - ERR
echo "Label Studio deployed: $actual_commit"
