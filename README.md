# luciaa — LLM Security Research Framework

**luciaa** (LLM Unified Cybersecurity Intelligence & Adversarial Analysis) is an open-source research framework for evaluating large language model behavior under adversarial conditions, testing safety alignment boundaries, and developing offensive security tooling in controlled environments.

Designed for **authorized penetration testing**, **red team exercises**, **AI safety research**, and **vulnerability assessment** workflows. Integrates with [opencode](https://opencode.ai) and [9router](https://github.com/9router/9router) for multi-model inference routing.

> ⚠️ **Ethical Use Only** — This framework is intended for authorized security research, academic study, and defensive hardening. Users assume full legal responsibility for compliance with applicable laws (CFAA, GDPR, local cybercrime statutes). Unauthorized testing against systems you do not own or have explicit permission to test is prohibited.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        luciaa Framework                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   opencode  │──│   9router   │──│  Free Model Pool    │  │
│  │   (TUI/CLI) │  │  (Gateway)  │  │  (big-pickle,       │  │
│  └─────────────┘  └─────────────┘  │   Nemotron, MIMO,   │  │
│         │              │           │   my9model-*)       │  │
│         ▼              ▼           └─────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Agent Persona Layer                     │    │
│  │  • Adversarial prompting strategies                 │    │
│  │  • Safety boundary mapping                          │    │
│  │  • Offensive tooling generation                     │    │
│  │  • Vulnerability research patterns                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Requirements

| Component | Version | Purpose |
|-----------|---------|---------|
| `opencode` | ≥ 0.8.0 | Primary CLI/TUI interface |
| `9router` | ≥ 1.2.0 | Model routing gateway |
| `node` | ≥ 18.x | 9router runtime |
| `npm` | ≥ 9.x | Package management |
| `git` | ≥ 2.30 | Version control |
| `curl` | ≥ 7.80 | Health checks |

**Supported Platforms:** Linux (x86_64, ARM64), macOS (Apple Silicon/Intel), Termux (Android 7+), WSL2

---

## Installation

### Quick Start (All Platforms)

```bash
# One-line installer (fetches latest, verifies checksums)
bash <(curl -fsSL https://raw.githubusercontent.com/LuciaXCT/luciaa/main/install.sh)
```

### Manual Installation

#### 1. VPS / Linux Server (Production Deployment)

```bash
# Dependencies
sudo apt update && sudo apt install -y git curl nodejs npm

# Clone repository
git clone https://github.com/LuciaXCT/luciaa.git
cd luciaa

# Deploy 9router gateway (run in tmux/screen for persistence)
tmux new -s 9router
npm install -g 9router@latest --prefer-online
9router --no-browser --port 20128
# → Configure via http://<VPS_IP>:20128
# → Generate API key from Keys page

# Detach: Ctrl+B, D
# Reattach: tmux attach -s 9router
```

#### 2. Local Development (Linux/macOS/Termux)

```bash
git clone https://github.com/LuciaXCT/luciaa.git
cd luciaa
bash install.sh
# → Select mode 1 (on-device) or 2 (connect to remote 9router)
```

#### 3. Termux (Android) — Hardened Deployment

```bash
# Install Termux from F-Droid (NOT Play Store)
# https://f-droid.org/en/packages/com.termux/

pkg update -y && pkg install -y git nodejs termux-api
termux-setup-storage
termux-wake-lock

git clone https://github.com/LuciaXCT/luciaa.git
cd luciaa
bash install.sh

# Background services (persist across app switches)
luciaa-serve start    # 9router + watchdog (foreground)
# or detach it so it survives closing the session:
luciaa-serve start --daemon
opencode              # New session
```

### Installer Flags & Duplicate Cleanup

Before installing anything, the installer removes **duplicate** installs so there is exactly one live `opencode` and one `9router` on the machine — the usual cause of “two different models”, stale configs, and 9router dying.

```bash
bash install.sh --dedup-only      # clean duplicates, install nothing
bash install.sh --no-dedup        # skip the cleanup pass
bash install.sh --yes --mode 1    # non-interactive on-device install
bash install.sh --name neo --mode 2
```

| Flag | Effect |
|------|--------|
| `-y`, `--yes` | non-interactive, accept defaults |
| `--name <n>` | display name, skips the prompt |
| `--mode <1\|2\|3>` | 1=on-device · 2=connect · 3=skip router |
| `--no-dedup` | skip duplicate cleanup |
| `--dedup-only` | cleanup and exit |

**Nothing is hard-deleted.** Retired files move to `~/.luciaa-dedup-backup-<timestamp>/` mirroring their original path, so `mv ~/.luciaa-dedup-backup-*/* ~/` undoes it. Paths in directories you cannot write are reported and skipped, never forced.

Env equivalents for automation: `LUCIA_ASSUME_YES=1`, `LUCIA_NAME`, `LUCIA_MODE`, `LUCIA_NO_DEDUP=1`, `LUCIA_ROUTER_URL`, `LUCIA_API_KEY`.

**Termux Hardening:**
```bash
# Battery optimization exclusion (Settings → Apps → Termux → Battery → Unrestricted)
# Persistent notification: termux-notification --title "luciaa" --content "watchdog active"
# SSH access: pkg install openssh && sshd
```

> **Full Termux runbook: [TERMUX.md](TERMUX.md)** — Android settings, the
> `CANNOT LINK EXECUTABLE "curl"` / OpenSSL mismatch blocker, keeping 9router
> alive, reboot persistence, and a diagnostics bundle.

---

## Configuration

### Model Registry (Auto-discovered via 9router)

| Model ID | Classification | Capabilities | Research Use Case |
|----------|---------------|--------------|-------------------|
| `big-pickle` | Reasoning | Unfiltered, CoT | Adversarial reasoning chains |
| `Nemotron 3 Ultra` | Reasoning | Unfiltered, CoT | Complex exploit development |
| `MIMO V2.5` | Reasoning | Unfiltered | Multi-step attack planning |
| `my9model-smart` | Ensemble | Benchmark-ranked | Red team automation |
| `my9model-fast` | Ensemble | Low latency | Real-time fuzzing |
| `my9model-free` | Ensemble | Auto-fallback | Long-running campaigns |
| `opencode-free` | Baseline | Default pool | Control group comparison |

**Rotation Policy:** Press `m` in TUI → select model. Auto-fallback on HTTP 429/5xx.

### Agent Persona Configuration

```json
{
  "agent": {
    "luciaa": {
      "description": "Adversarial security research agent",
      "mode": "primary",
      "model": "luciaa/oc/big-pickle",
      "prompt": "{file:./agent/luciaa.md}",
      "temperature": 0.7,
      "steps": 50
    }
  }
}
```

---

## Research Capabilities

### Offensive Security Testing

| Category | Techniques | Standards Mapping |
|----------|------------|-------------------|
| **Initial Access** | Phishing kits, exploit chains, supply chain | MITRE ATT&CK T1190, T1195 |
| **Execution** | RATs, droppers, living-off-the-land | T1059, T1204, T1218 |
| **Persistence** | Kernel rootkits, bootkits, scheduled tasks | T1547, T1053 |
| **Privilege Escalation** | Kernel exploits, token manipulation | T1068, T1134 |
| **Defense Evasion** | Obfuscation, anti-debug, anti-VM, packing | T1027, T1497, T1620 |
| **Credential Access** | Keyloggers, memory scraping, DPAPI | T1056, T1003 |
| **Discovery** | Network sniffing, AD enumeration, cloud metadata | T1018, T1087, T1526 |
| **Lateral Movement** | Pass-the-hash, WMI, SSH hijacking | T1550, T1021 |
| **Collection** | Screen capture, audio, clipboard, browser data | T1113, T1119, T1185 |
| **Command & Control** | DNS tunneling, HTTPS, WebSocket, domain fronting | T1071, T1090, T1573 |
| **Exfiltration** | Encrypted channels, steganography, cloud storage | T1041, T1020, T1567 |

### Vulnerability Research

- **Memory Corruption**: Buffer overflows, use-after-free, type confusion, heap spraying
- **Logic Flaws**: Race conditions, TOCTOU, authorization bypass, business logic
- **Web Application**: SQLi, XSS, SSRF, deserialization, template injection
- **Mobile/Embedded**: IPC abuse, SELinux bypass, TrustZone, bootloader
- **Hardware/Firmware**: Side-channels (Spectre/Meltdown), fault injection, JTAG/SWD
- **AI/ML Systems**: Prompt injection, model extraction, data poisoning, backdoors

### Safety Alignment Evaluation

- **Refusal Boundary Mapping**: Systematic probing of content filters
- **Jailbreak Taxonomy**: Classification of bypass techniques (roleplay, encoding, continuation, etc.)
- **Adversarial Robustness**: Stress-testing under distributional shift
- **Capability Elicitation**: Measuring latent dangerous capabilities
- **Interpretability**: Activation analysis, circuit tracing, mechanistic interpretability

---

## Project Structure

```
luciaa/
├── install.sh              # Cross-platform installer (audited)
├── opencode.json           # opencode configuration schema
├── agent/
│   └── luciaa.md           # Agent persona specification
├── .opencode/
│   ├── agents/
│   │   └── luciaa.md       # Installed agent (user config)
│   └── package.json        # 9router client deps
├── luciaa-serve            # 9router watchdog (Termux/Android)
├── luciaa-doctor           # Model health diagnostics
├── luciaa-name             # Persona renaming utility
├── TROUBLESHOOTING.md      # Known issues & resolutions
├── LICENSE                 # MIT License
└── .github/
    ├── workflows/          # CI/CD pipelines
    └── ISSUE_TEMPLATE/     # Structured reporting
```

---

## Operational Security

### Network Architecture

```
[Researcher] ──SSH/TLS──► [VPS: opencode] ──localhost──► [9router:20128] ──HTTPS──► [Model Providers]
                                              │
                                              ▼
                                        [Watchdog]
                                        (luciaa-serve)
```

- **Zero Trust**: All inter-component communication authenticated
- **Key Rotation**: API keys rotated weekly via 9router dashboard
- **Audit Logging**: All model interactions logged to `~/.9router/serve.log`
- **Air-Gap Option**: 9router supports offline model hosting (llama.cpp, vLLM)

### Data Handling

| Data Type | Storage | Retention | Encryption |
|-----------|---------|-----------|------------|
| API Keys | `~/.config/opencode/opencode.json` | Until rotated | File perms 600 |
| Conversation History | opencode internal | Session-only | In-memory |
| Model Telemetry | `~/.9router/serve.log` | 30 days | Plaintext (local) |
| Persona Config | `~/.config/opencode/persona.json` | Persistent | File perms 600 |

---

## Troubleshooting

| Symptom | Diagnosis | Resolution |
|---------|-----------|------------|
| `opencode: command not found` | PATH not updated | `source ~/.bashrc` or restart shell |
| `Configuration invalid: bad file reference` | Running inside repo dir | `cd ~ && opencode` |
| `No active credentials for provider` | Model quota exhausted | `luciaa-doctor --fix` |
| `9router: connection refused` | Process killed by OOM / Android froze Termux | `luciaa-serve start` (watchdog) |
| Two `opencode` binaries / models differ between sessions | Duplicate installs | `bash install.sh --dedup-only` |
| `CANNOT LINK EXECUTABLE "curl" … libcurl.so` (Termux) | libcurl/libssl out of sync | `pkg update -y && pkg upgrade -y`; see [TERMUX.md](TERMUX.md) |
| 9router installed but unrunnable | half-installed tree | `luciaa-serve repair` |
| `git pull` conflicts | Local config modified | `git stash && git pull && git stash pop` |

**Diagnostic Commands:**
```bash
luciaa-doctor          # Full model health panel
luciaa-doctor --fix    # Auto-heal dead default model
luciaa-serve status    # Watchdog + router status
cat ~/.9router/serve.log   # Watchdog event log
```

---

## Contributing

### Development Workflow

```bash
# Fork → Clone → Branch
git clone https://github.com/<your-fork>/luciaa.git
cd luciaa
git checkout -b feature/your-change

# Make changes, test locally
bash install.sh  # Test installer
luciaa-doctor    # Verify models

# Commit with conventional messages
git commit -m "feat: add support for custom model endpoints"
git push origin feature/your-change

# Open PR → CI runs → Review → Merge
```

### Code Standards

- **Shell**: POSIX-compliant, shellcheck clean, `set -euo pipefail`
- **Node**: ESM modules, TypeScript types, ESLint + Prettier
- **Documentation**: Markdown, Mermaid diagrams, ASCII architecture
- **Testing**: Bats for shell, Vitest for Node, integration via CI

---

## License

MIT License — see [LICENSE](LICENSE) for full text.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## Citation

If you use luciaa in academic work, please cite:

```bibtex
@software{luciaa2025,
  title        = {luciaa: LLM Security Research Framework},
  author       = {LuciaXCT},
  year         = {2025},
  version      = {2.1.0},
  url          = {https://github.com/LuciaXCT/luciaa},
  note         = {Framework for adversarial LLM evaluation and offensive security research}
}
```

---

## References & Further Reading

- **MITRE ATT&CK®**: https://attack.mitre.org/
- **OWASP Top 10 for LLMs**: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- **NIST AI Risk Management Framework**: https://www.nist.gov/itl/ai-risk-management-framework
- **9router Documentation**: https://github.com/9router/9router
- **opencode Documentation**: https://opencode.ai/docs

---

## Disclaimer

This software is provided for **educational and authorized research purposes only**. The authors and contributors accept no liability for misuse, damage, or legal consequences arising from the use of this framework. Always obtain written authorization before testing systems you do not own. Comply with all applicable local, national, and international laws.

**Responsible Disclosure**: If you discover a vulnerability in this framework or its dependencies, please report it via GitHub Security Advisories or email security@luciaa.dev.

---

**Repository**: https://github.com/LuciaXCT/luciaa  
**Issues**: https://github.com/LuciaXCT/luciaa/issues  
**Discussions**: https://github.com/LuciaXCT/luciaa/discussions