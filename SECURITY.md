# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities to the security team immediately. Do not disclose vulnerabilities repeatedly or publicly until they have been addressed.

## Secret Management & Token Rotation

### 1. Never Commit Secrets
- **Never** commit API keys, service account credentials, or private tokens to the repository.
- Use `git-secrets` or similar tools to scan commits before pushing.

### 2. Handling Exposed Tokens
If a token is exposed (e.g., in `deploy.yml` or git history):
1.  **Revoke Immediately**: Go to the provider's console (e.g., Google Cloud Console) and revoke/delete the compromised key.
2.  **Generate New Key**: Create a new service account key or API token.
3.  **Update GitHub Secrets**:
    - Go to `Settings` > `Secrets and variables` > `Actions`.
    - Update `GCP_SA_KEY` or `VITE_GEMINI_API_KEY` with the new value.
4.  **Verify**: Trigger a new build to ensure the new key works.
