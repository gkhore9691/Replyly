# Launch Checklist

## Pre-Launch

- [ ] All unit tests passing (`npm test`)
- [ ] Load test run successfully (`k6 run -e API_KEY=xxx tests/load/ingestion.k6.js`)
- [ ] Security headers and health check verified
- [ ] Documentation complete (SDK README, DEPLOYMENT.md)
- [ ] Example projects run (examples/express, examples/nextjs-api)
- [ ] Error handling and masking tested
- [ ] MongoDB indexes created (`npm run db:ensure-mongo-indexes`)
- [ ] SSL and domain configured (production)

## Launch Day

- [ ] Deploy application and worker
- [ ] Verify `GET /api/health` returns 200
- [ ] Test SDK integration with example app
- [ ] Monitor error rates and queue depth
- [ ] Verify authentication and webhooks (if used)

## Post-Launch

- [ ] Monitor for 24 hours
- [ ] Collect feedback and fix critical issues
- [ ] Optimize based on metrics
