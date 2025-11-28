# Video Call App

A modern video calling application built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui - similar to Microsoft Teams.

## Tech Stack

- **Framework**: Next.js 16.0.5 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (New York style)
- **Icons**: Lucide React
- **State Management**: React 19.2.0

## Installed shadcn/ui Components

The following UI components are ready to use:
- Button
- Card
- Avatar
- Badge
- Dialog
- Dropdown Menu
- Input
- Separator
- Tooltip

## Project Structure

```
video-call/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   └── ui/          # shadcn/ui components
│   └── lib/             # Utility functions
├── public/              # Static assets
└── package.json
```

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Adding More Components

To add more shadcn/ui components:

```bash
npx shadcn@latest add [component-name]
```

Browse available components at [ui.shadcn.com](https://ui.shadcn.com)

## Next Steps

1. Set up WebRTC for video/audio streaming
2. Implement room creation and joining
3. Add participant management
4. Create video grid layout
5. Add chat functionality
6. Implement screen sharing
7. Add meeting controls (mute, camera toggle, etc.)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WebRTC Documentation](https://webrtc.org/getting-started/overview)
