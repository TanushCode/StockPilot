#!/usr/bin/env bash
# StockPilot - Automated EC2 Instance Provisioning Script
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS

set -e

echo "=========================================================="
echo " Starting StockPilot EC2 Deployment Setup"
echo "=========================================================="

sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y python3-pip python3-venv nginx git curl

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Backend Virtual Environment
echo "Setting up Python backend..."
cd /home/ubuntu/stockpilot/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Run initial seed if needed
python seed.py

# Frontend Build
echo "Building React frontend..."
cd /home/ubuntu/stockpilot/frontend
npm install
npm run build

# Configure Nginx
echo "Configuring Nginx..."
sudo cp /home/ubuntu/stockpilot/deploy/nginx.conf /etc/nginx/sites-available/stockpilot
sudo ln -sf /etc/nginx/sites-available/stockpilot /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Setup Systemd Services
echo "Configuring systemd services..."
sudo cp /home/ubuntu/stockpilot/deploy/stockpilot-api.service /etc/systemd/system/
sudo cp /home/ubuntu/stockpilot/deploy/stockpilot-worker.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable stockpilot-api
sudo systemctl start stockpilot-api

sudo systemctl enable stockpilot-worker
sudo systemctl start stockpilot-worker

echo "=========================================================="
echo " StockPilot Deployment Completed Successfully!"
echo " Access your system via your EC2 Public IPv4 address."
echo "=========================================================="
