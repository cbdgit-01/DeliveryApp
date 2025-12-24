# Delivery Management System - Frontend

React + Vite frontend for the Delivery Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (optional):
```env
VITE_API_URL=http://localhost:8000
```

3. Start development server:
```bash
npm run dev
```

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview Production Build

```bash
npm run preview
```

## Features

- **Mobile-First Design**: Optimized for iPhone and mobile devices
- **PWA Support**: Can be installed as a native app
- **FullCalendar Integration**: Drag-and-drop scheduling interface
- **Real-Time Updates**: Live task and calendar updates
- **Responsive Layout**: Works on all screen sizes

## Pages

- `/login` - User authentication
- `/` - Dashboard with task overview
- `/calendar` - FullCalendar scheduling interface
- `/tasks/new` - Create new delivery task
- `/tasks/:id` - Task detail view

## Components

- `Layout` - Main app layout with navigation
- `Login` - Authentication form
- `Dashboard` - Task list and statistics
- `Calendar` - FullCalendar with drag-and-drop
- `CreateTask` - Task creation form
- `TaskDetail` - Detailed task view and editing

## Deployment

### Vercel
1. Push to GitHub
2. Import project in Vercel
3. Set environment variable: `VITE_API_URL`
4. Deploy

### Netlify
1. Push to GitHub
2. Import project in Netlify
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Set environment variable: `VITE_API_URL`
5. Deploy

## PWA Configuration

The app is configured as a PWA in `vite.config.js` using `vite-plugin-pwa`.

To customize the PWA:
- Edit manifest in `vite.config.js`
- Add icons to `public/` directory
- Update service worker settings

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:8000)

## Browser Support

- Chrome/Edge (latest 2 versions)
- Safari (latest 2 versions)
- Firefox (latest 2 versions)
- iOS Safari 12+
- Android Chrome 80+





