# Running Codex-open-dot continuously

A persistent server runs the same agent runner, workflow engine and scheduler. A cloud browser alone does not keep the scheduler alive.

1. Build with `docker compose build` on a host with Docker.
2. Set `DOTS_ADMIN_PASSWORD` to at least 16 characters in the server environment (do not commit it).
3. Set `DOTS_PUBLIC_URL` to the URL people will use and `DOTS_WORKSPACE_ID` to a stable workspace identifier.
4. Run `docker compose up -d` and open the login page.
5. For access beyond the host, put an HTTPS reverse proxy in front of the loopback-only published port. Preserve the public Host and Origin. Do not expose the raw port publicly.
6. Add provider credentials through Settings and use E2B for agent computers if the container has no browser. The default image does not contain Chrome or Docker-in-Docker.

The named volume retains the database and files across container restarts. Keep one application process per workspace: the scheduler and execution engine are not designed for multiple replicas. Interrupted tasks require explicit review/resumption; uncertain external actions are never automatically replayed.

The first server login uses username `admin` and the bootstrap password. Subsequent membership management is workspace-local. Separate workspace instances must have separate data volumes, hostnames and workspace IDs. Do not reuse session secrets between instances.

Local verification is not a live deployment. DNS, HTTPS, real provider credentials, availability monitoring and offsite backups must be verified on the target host before relying on it.
