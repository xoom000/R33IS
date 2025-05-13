# R33IS Deployment Server Specs

This document provides key information about the system environment where the R33IS project is deployed. It is meant to help automation agents, AI copilots, and human collaborators understand the deployment context without guesswork.

---

## Server Info

| Property       | Value                        |
|----------------|------------------------------|
| Hostname       | ubuntu-s-1vcpu-1gb-amd-sfo3-01 |
| OS             | Ubuntu 24.10                 |
| Kernel         | Linux 6.11.0-25-generic      |
| Architecture   | x86_64                       |
| Public IP      | *(not yet confirmed)*        |
| Internal IP    | 10.48.0.5                    |
| External IP    | 24.199.121.11                |
| SSH User       | root                         |
| Uptime         | 4 days+                      |

---

## Hardware

| Component | Value         |
|-----------|---------------|
| CPU       | 1 vCPU        |
| RAM       | ~961 MB       |
| Swap      | Not in use    |

---

## Software

| Tool         | Version     |
|--------------|-------------|
| Node.js      | v18.20.8    |
| npm          | 10.8.2      |
| Python3      | 3.12.7      |
| Git          | 2.45.2      |
| SQLite3      | Not yet installed |
| htop         | Available   |
| tree         | Not yet installed |

---

## Network / Firewall (UFW)

| Rule        | Status |
|-------------|--------|
| Nginx Full  | ALLOW  |
| OpenSSH     | ALLOW  |

---

## Notes for Agents

- SQLite3 **must be installed** before database migration scripts can be run.
- Public IP may need confirmation (`curl ifconfig.me` timed out).
- Git and Node are ready for cloning and building R33IS.
- Working directory currently resides under `/root/`.

---

## To-Do

- [ ] Install SQLite3 with `apt install sqlite3`
- [ ] Confirm ngrok configuration if tunnels are needed
- [ ] Clone latest `R33IS` repo and run install
- [ ] Run `npm install` in `/api` and `/cli` directories
- [ ] Add `.env` files for both backend and frontend
