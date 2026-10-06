Reyden & Mariel Trend Hub — Live Order Receiver V8

WHAT THIS UPDATE DOES
- Keeps the existing Cart -> Checkout -> Review flow.
- Changes the final action from a local-only order to a REAL online submission.
- Sends confirmed orders to a Google Sheet using a free Google Apps Script Web App.
- Verifies that the order reference actually reached the Google Sheet before showing success.
- Keeps the cart and checkout details if submission/verification fails, so the customer can retry.
- Prevents duplicate rows when the same order reference is retried.
- Saves a local copy only AFTER the store receiver confirms the order.

NEW FILES
- js/store-config.js
- apps-script/Code.gs

UPDATED FILES
- review.html
- js/review.js
- css/review.css

============================================================
STEP 1 — INSTALL V8 IN TERMUX
============================================================
cd ~/online-store/rm-trend-hub
unzip -o ~/storage/downloads/rm-trend-hub-live-orders-v8.zip -d .

============================================================
STEP 2 — CREATE THE FREE GOOGLE SHEET ORDER RECEIVER
============================================================
1. Open Google Sheets and create a new spreadsheet.
   Suggested name: Reyden & Mariel Trend Hub Orders

2. In the spreadsheet, open:
   Extensions > Apps Script

3. Delete the default Apps Script code.

4. Open this project file:
   apps-script/Code.gs

5. Copy all of Code.gs and paste it into Apps Script.

6. Save the Apps Script project.

7. At the top of Apps Script, choose the function:
   setupOrderSheet
   Then click Run.

8. Approve the Google permission request.
   This creates/configures the Orders sheet and saves its spreadsheet ID.

============================================================
STEP 3 — DEPLOY AS A WEB APP
============================================================
1. In Apps Script click:
   Deploy > New deployment

2. Click the gear icon / Select type > Web app.

3. Use:
   Execute as: Me
   Who has access: Anyone

4. Click Deploy.

5. Copy the Web App URL.
   IMPORTANT: use the URL ending in /exec, not /dev.

============================================================
STEP 4 — CONNECT YOUR WEBSITE
============================================================
Open:
js/store-config.js

Change:
orderEndpoint: "",

To your Apps Script URL, for example:
orderEndpoint: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",

Save the file.

============================================================
STEP 5 — TEST
============================================================
Start your local web server normally, then open:
http://localhost:3000/cart.html

Test the complete flow:
Cart -> Proceed to Checkout -> Continue to Review -> Place Order

After a successful order:
- The website shows "Order received!"
- The cart is cleared.
- A new row appears in the Google Sheet under the Orders tab.

If the receiver is not configured or receipt cannot be verified, the cart is NOT cleared.

============================================================
IMPORTANT BEFORE PUBLIC RELEASE
============================================================
- Keep the Apps Script deployment set to "Anyone" so customers can submit without signing in.
- Do not put passwords, private API keys, bank secrets, or administrator credentials in store-config.js. It is a public website file.
- The Apps Script endpoint is an order intake endpoint, not a secret credential.
- Delivery fee and payment method are still intentionally "To be confirmed".
- V8 does not yet add an admin dashboard, order status page, online payment, or automatic customer notification. Those can be built in later phases.
