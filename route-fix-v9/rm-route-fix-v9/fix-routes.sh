#!/data/data/com.termux/files/usr/bin/bash
set -e

PROJECT="${1:-$HOME/online-store/rm-trend-hub}"
cd "$PROJECT"

echo "Fixing static-page routes in: $PROJECT"

# Backup only the files we may touch.
mkdir -p .route-fix-backup-v9
for f in index.html cart.html checkout.html review.html js/app.js js/cart.js js/checkout.js js/review.js; do
  if [ -f "$f" ]; then
    mkdir -p ".route-fix-backup-v9/$(dirname "$f")"
    cp -f "$f" ".route-fix-backup-v9/$f"
  fi
done

# Python's http.server and GitHub Pages need explicit .html filenames for this project.
find . -maxdepth 2 -type f \( -name '*.js' -o -name '*.html' \) ! -path './.route-fix-backup-v9/*' -print0 | \
  xargs -0 sed -i \
    -e 's|"/cart"|"cart.html"|g' \
    -e "s|'/cart'|'cart.html'|g" \
    -e 's|"/checkout"|"checkout.html"|g' \
    -e "s|'/checkout'|'checkout.html'|g" \
    -e 's|"/review"|"review.html"|g' \
    -e "s|'/review'|'review.html'|g"

# Cache-bust the navigation JavaScript so Android Chrome does not keep an older route.
[ -f index.html ] && sed -i -E 's|src="js/app\.js(\?[^\"]*)?"|src="js/app.js?v=9"|g' index.html
[ -f cart.html ] && sed -i -E 's|src="js/cart\.js(\?[^\"]*)?"|src="js/cart.js?v=9"|g' cart.html
[ -f checkout.html ] && sed -i -E 's|src="js/checkout\.js(\?[^\"]*)?"|src="js/checkout.js?v=9"|g' checkout.html
[ -f review.html ] && sed -i -E 's|src="js/review\.js(\?[^\"]*)?"|src="js/review.js?v=9"|g' review.html
[ -f review.html ] && sed -i -E 's|src="js/store-config\.js(\?[^\"]*)?"|src="js/store-config.js?v=9"|g' review.html

echo
echo "Checking required pages..."
for f in index.html cart.html checkout.html review.html; do
  if [ -f "$f" ]; then
    echo "OK  $f"
  else
    echo "MISSING  $f"
  fi
done

echo
echo "Remaining extensionless route references (should be empty):"
grep -RInE '(["'"'"'])/(cart|checkout|review)(["'"'"'])' --include='*.js' --include='*.html' . --exclude-dir=.route-fix-backup-v9 || true

echo
echo "Done. Restart the server and open:"
echo "http://localhost:3000/index.html?v=9"
