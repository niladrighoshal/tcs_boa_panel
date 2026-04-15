# TCS BOA Panel

A Progressive Web App (PWA) for managing BOA panel scheduling and assignments.

## Features

- Daily TR/MR scheduling with smart rest rotation
- Associate management
- Technology tracking
- History logging
- PWA support (installable, offline-capable)

## Authentication

To access the application, use the following credentials:

- **Username:** tcspanellist@bofa.com
- **Password:** NiladriGhoshal19

Once logged in, the session persists until the browser cache/storage is cleared. No logout functionality is provided - users stay logged in permanently unless manually clearing data.

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

```bash
npm install
```

### Running the App

```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment

The app is configured as a PWA and can be deployed to static hosting platforms like Vercel, Netlify, or GitHub Pages.

## Tech Stack

- React 19
- Vite
- React Icons
- PWA with vite-plugin-pwa
