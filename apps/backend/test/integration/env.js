// Deterministic local auth config. Integration tests use their own database
// and must never load credentials for a real email service from .env.
Object.assign(process.env, {
  BETTER_AUTH_SECRET: 'quacker-integration-only-auth-secret',
  BACKEND_URL: 'http://localhost:4050',
  FRONTEND_URL: 'http://localhost:3050',
  RESEND_API_KEY: '',
  SMTP_HOST: '',
});
