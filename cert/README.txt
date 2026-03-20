Code Companion — HTTPS (self-signed certificate)
=================================================

To run the app over HTTPS (e.g. to avoid browser HSTS/SSL issues on localhost):

1. Generate a self-signed certificate and key in this directory:

   openssl req -nodes -new -x509 -keyout server.key -out server.crt -days 365 -subj "/CN=localhost"

   Run this from inside the cert/ directory (cd cert first), or from the app root use keyout cert/server.key -out cert/server.crt. Creates server.key and server.crt valid for 1 year.

2. Restart the app (./startup.sh or your normal start command).

3. Open https://localhost:3000 in your browser and accept the self-signed certificate warning.

Optional: for a specific hostname or IP (e.g. for remote access), use:

   openssl req -nodes -new -x509 -keyout server.key -out server.crt -days 365 -subj "/CN=YOUR_HOST_OR_IP"

Replace YOUR_HOST_OR_IP with your machine's IP or hostname.

Do not commit server.key (or any private key) to version control.
