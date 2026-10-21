#!/usr/bin/env bash
# Run once as root on the approved Dockerhost. Registration token comes from stdin.
set -Eeuo pipefail
read -r RUNNER_REGISTRATION_TOKEN
RUNNER_DIR=/opt/actions-runner-label-studio
RUNNER_USER=label-studio-runner
if [[ -e "$RUNNER_DIR/.runner" ]]; then echo 'Runner already configured; no changes made.'; exit 0; fi
if ! id "$RUNNER_USER" >/dev/null 2>&1; then useradd --create-home --shell /bin/bash "$RUNNER_USER"; fi
usermod -aG docker "$RUNNER_USER"
mkdir -p "$RUNNER_DIR" /docker/label-studio
chown "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR" /docker/label-studio
archive=$(mktemp /tmp/label-studio-runner.XXXXXXXX.tar.gz)
trap 'rm -f "$archive"' EXIT
curl -fL --retry 3 -o "$archive" https://github.com/actions/runner/releases/download/v2.338.0/actions-runner-linux-x64-2.338.0.tar.gz
printf '%s  %s\n' af4b794c1bc41d73d40535e3fe092a39f9679cd8d965954c2aca25a05ca41d32 "$archive" | sha256sum --check
tar xzf "$archive" -C "$RUNNER_DIR"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"
cd "$RUNNER_DIR"
./bin/installdependencies.sh
runuser -u "$RUNNER_USER" -- ./config.sh --unattended --url https://github.com/remb0/label-studio --token "$RUNNER_REGISTRATION_TOKEN" --name label-studio-dockerhost --labels label-studio-deploy --work _work --disableupdate
unset RUNNER_REGISTRATION_TOKEN
./svc.sh install "$RUNNER_USER"
./svc.sh start
./svc.sh status
