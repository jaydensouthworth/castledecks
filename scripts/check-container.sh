#!/usr/bin/env bash
set -euo pipefail

# Run from the repository root. Docker is needed only for this deployment check.
image_tag=castledecks-smoke:local
container_id=
response_dir=$(mktemp -d)
cleanup() {
  if [[ -n "$container_id" ]]; then docker rm -f "$container_id" >/dev/null; fi
  rm -rf "$response_dir"
}
trap cleanup EXIT

docker build --tag "$image_tag" .
container_id=$(docker run --detach --publish 127.0.0.1::80 "$image_tag")
docker exec "$container_id" nginx -t
address=$(docker port "$container_id" 80/tcp)
origin="http://$address"
for attempt in {1..30}; do
  if curl --silent --fail "$origin/" >/dev/null; then break; fi
  sleep 0.5
done

curl --silent --show-error --fail "$origin/" --output "$response_dir/body"
cmp site/dist/index.html "$response_dir/body"
for route in index about battle lab phone-preview; do
  curl --silent --show-error --fail "$origin/$route?smoke=1" --output "$response_dir/body"
  cmp "site/dist/$route.html" "$response_dir/body"
done
curl --silent --show-error --fail "$origin/battle.html" --output "$response_dir/body"
cmp site/dist/battle.html "$response_dir/body"
curl --silent --show-error --fail "$origin/battle.mjs" --dump-header "$response_dir/headers" --output "$response_dir/body"
cmp site/dist/battle.mjs "$response_dir/body"
grep -Eiq '^content-type: (text|application)/javascript([;[:space:]]|$)' "$response_dir/headers"
grep -Eiq '^cache-control: no-cache[[:space:]]*$' "$response_dir/headers"
grep -Eiq '^x-content-type-options: nosniff[[:space:]]*$' "$response_dir/headers"
for route in missing-route missing-module.mjs; do
  status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$origin/$route")
  [[ "$status" == 404 ]]
done
runtime_files=0
while IFS= read -r -d '' file; do
  route=${file#site/dist/}
  curl --silent --show-error --fail "$origin/$route" --output "$response_dir/body"
  cmp "$file" "$response_dir/body"
  runtime_files=$((runtime_files + 1))
done < <(find site/dist -type f -print0)
echo "Container runtime byte equality passed: $runtime_files files."
echo 'Container smoke checks passed: routes, exact source bytes, module MIME, cache headers and missing-file 404s.'
