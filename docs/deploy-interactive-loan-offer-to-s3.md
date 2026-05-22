# Deploy Interactive Loan Offer (Frontend) to S3

The Interactive Loan Offer experience is a React SPA route:

- `/loan-offer/:id` → `Frontend/src/pages/InteractiveLoanOffer.tsx`

If you want the *end result* to live on S3 (typically behind CloudFront), you
deploy the **built frontend** (`Frontend/dist/`) to S3.

## 1) Build the frontend with a real backend API origin

The frontend calls the backend using `API_BASE_URL`.

- In Docker+Nginx, `/api/*` is reverse-proxied to the backend container.
- In S3 hosting, there is **no reverse proxy**, so you must bake an absolute API
  origin into the build.

Example:

```bash
cd Frontend
export VITE_API_BASE_URL="https://YOUR_BACKEND_DOMAIN_OR_IP:8000"
npm install
npm run build
```

This makes the app call:

- `https://YOUR_BACKEND_DOMAIN_OR_IP:8000/generate/remotion` (etc.)
- `https://YOUR_BACKEND_DOMAIN_OR_IP:8000/interactive/loan-offer/:id`

## 1b) Make backend-generated `interactive_url` point to the new host

The backend builds `interactive_url` from `FRONTEND_URL` (`app/config.py` → `settings.frontend_url`).

Set this in your `.env` to your CloudFront/S3 site origin:

```env
FRONTEND_URL=https://YOUR_CLOUDFRONT_DOMAIN
```

## 2) Upload `Frontend/dist/` to S3

From the repo root (with your backend venv activated so `boto3` is available):

```bash
python3 scripts/deploy_frontend_to_s3.py \
  --bucket YOUR_FRONTEND_BUCKET \
  --prefix "" \
  --dist-dir Frontend/dist
```

Optional:

- `--prefix web/` to upload under a subpath like `s3://bucket/web/...`
- `--dry-run` to see keys without uploading
- `--public-read` if your bucket still allows object ACLs (many don't)

## 3) SPA deep-link routing (required for `/loan-offer/:id`)

When a user opens a deep link like:

`/loan-offer/6a0ee7b9066b5b948edc9954`

S3 will look for a literal object at that key and otherwise return 403/404.

Recommended approach:

- Put CloudFront in front of S3
- Configure custom error responses:
  - 403 → `/index.html` with HTTP 200
  - 404 → `/index.html` with HTTP 200

This emulates the Nginx `try_files ... /index.html` behavior used in
`Frontend/nginx.conf.template`.
