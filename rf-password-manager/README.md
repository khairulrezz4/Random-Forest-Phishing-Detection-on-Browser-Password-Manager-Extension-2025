# RezzaRF Password Manager with Phishing Detection (Random Forest)

A browser extension that combines password management with ML-based phishing detection to protect users from malicious websites.

## Features

- **AI-Powered Phishing Detection**: Uses Random Forest model to analyze URLs and detect phishing attempts
- **Smart Password Vault**: Securely stores credentials with risk scoring
- **Auto-fill Detection**: Automatically detects login pages and enables filling
- **Real-time Risk Assessment**: Evaluates site safety before saving credentials
- **Multi-frame Support**: Works with login forms in iframes

## Tech Stack

- **Frontend**: React + Vite
- **Extension**: Chrome MV3
- **ML Backend**: Python Flask (Random Forest classifier)
- **Storage**: Chrome Storage API

## Setup

### Extension
```bash
cd rf-password-manager
npm install
npm run build
```

Load the unpacked extension from `rf-password-manager/public` in Chrome.

### ML Server
```bash
cd ML
pip install -r requirements.txt
python server.py
```

---

## React + Vite Template Notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
