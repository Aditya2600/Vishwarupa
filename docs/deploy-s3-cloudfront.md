# Deploy Vite React Frontend to S3 + CloudFront

This deploys the interactive React experience, including:

- `/loan-offer/:id`
- `/loan-reminder/:id`

This does not generate videos. Remotion MP4 files are uploaded separately and returned by the backend as `video_url`.

## Build

```bash
cd Frontend
npm run build