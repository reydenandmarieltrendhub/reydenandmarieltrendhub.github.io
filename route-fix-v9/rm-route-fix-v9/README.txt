Reyden & Mariel Trend Hub — Route Fix V9

Problem fixed:
Python's `python -m http.server 3000` does not automatically map `/cart`, `/checkout`, or `/review` to `.html` files.

Install/run in Termux:

cd ~/online-store/rm-trend-hub
unzip -o ~/storage/downloads/rm-trend-hub-route-fix-v9.zip -d route-fix-v9
bash route-fix-v9/fix-routes.sh

Then stop the current server with Ctrl+C and restart:

python -m http.server 3000

Open:
http://localhost:3000/index.html?v=9

Expected routes:
http://localhost:3000/cart.html
http://localhost:3000/checkout.html
http://localhost:3000/review.html

A backup of touched files is created at:
.route-fix-backup-v9/
