#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DESKTOP_DIR="${HOME}/Desktop"

create_app_bundle() {
  local app_name="$1"
  local script_name="$2"
  local app_path="${DESKTOP_DIR}/${app_name}.app"

  rm -rf "${app_path}"
  mkdir -p "${app_path}/Contents/MacOS"
  mkdir -p "${app_path}/Contents/Resources"

  cat >"${app_path}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>${script_name}</string>
  <key>CFBundleIdentifier</key>
  <string>com.ultraroadbook.${script_name}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${app_name}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.10</string>
  <key>CFBundleVersion</key>
  <string>0.10</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.15</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
EOF

  cat >"${app_path}/Contents/MacOS/${script_name}" <<EOF
#!/usr/bin/env bash
export ULTRA_ROADBOOK_ROOT="${PROJECT_ROOT}"
exec "${PROJECT_ROOT}/launcher/${script_name}.sh"
EOF

  chmod +x "${app_path}/Contents/MacOS/${script_name}"
}

create_app_bundle "Ultra Roadbook" "launch"
create_app_bundle "Stop Ultra Roadbook" "stop"

echo "Installed launchers to:"
echo "  ${DESKTOP_DIR}/Ultra Roadbook.app"
echo "  ${DESKTOP_DIR}/Stop Ultra Roadbook.app"
