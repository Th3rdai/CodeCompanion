#!/bin/bash
# Add Node to macOS Firewall so the Code Companion server can accept remote connections.
# Run once (requires sudo). Then open System Settings → Network → Firewall → Options
# and set "node" to "Allow incoming connections". Restart the app after.

set -e
NODE=$(which node 2>/dev/null || command -v node)
if [ -z "$NODE" ]; then
  echo "Could not find node in PATH."
  exit 1
fi
echo "Adding Node to firewall: $NODE"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE"
echo ""
echo "Done. Next:"
echo "  1. Open System Settings → Network → Firewall → Options"
echo "  2. Find 'node' and set it to 'Allow incoming connections'"
echo "  3. Restart Code Companion (./startup.sh)"
echo "  4. From another device open http://YOUR_MAC_IP:8900 (use the 'Remote access:' URL from the server log)"
