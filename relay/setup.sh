#!/bin/bash
# Openfy Relay — Oracle Cloud setup script
# Run this on your free Oracle Cloud VM (Ubuntu or Oracle Linux)

set -e

echo "=== Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || {
  # Oracle Linux uses dnf
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
}
sudo apt-get install -y nodejs 2>/dev/null || sudo dnf install -y nodejs

echo "=== Setting up relay ==="
sudo mkdir -p /opt/openfy-relay
sudo cp -r ./* /opt/openfy-relay/
cd /opt/openfy-relay
sudo npm install --production

echo "=== Creating systemd service ==="
sudo tee /etc/systemd/system/openfy-relay.service > /dev/null <<'EOF'
[Unit]
Description=Openfy Listen Along Relay
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/openfy-relay
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=PORT=4000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable openfy-relay
sudo systemctl start openfy-relay

echo "=== Opening firewall port 4000 ==="
sudo iptables -I INPUT -p tcp --dport 4000 -j ACCEPT 2>/dev/null || true
sudo firewall-cmd --permanent --add-port=4000/tcp 2>/dev/null && sudo firewall-cmd --reload 2>/dev/null || true

echo ""
echo "=== Done! ==="
echo "Relay running on port 4000"
echo ""
echo "IMPORTANT: You also need to open port 4000 in Oracle Cloud's Security List:"
echo "  1. Go to cloud.oracle.com → Networking → Virtual Cloud Networks"
echo "  2. Click your VCN → Security Lists → Default Security List"
echo "  3. Add Ingress Rule: Source 0.0.0.0/0, TCP, Port 4000"
echo ""
echo "Then set RELAY_URL in your Openfy app:"
echo "  RELAY_URL=http://YOUR_VM_PUBLIC_IP:4000"
