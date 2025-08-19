# Chat App

A beautiful, real-time chat application built with Next.js 14, Prisma, and PostgreSQL. Features a ChatGPT-inspired UI with a modern blue color scheme.

## Features

- 🎨 **Beautiful UI**: ChatGPT-inspired interface with modern blue theme
- 💬 **Real-time Chat**: Polling-based message updates (2-second intervals)
- 🏠 **Chat Rooms**: Create and switch between multiple chat rooms
- 👤 **Username System**: Local username identification (no user accounts)
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- 🐳 **Docker Ready**: Production and development Docker configurations
- ⚡ **Server Actions**: Next.js 14 server actions for data operations
- 🔄 **SWR Integration**: Efficient data fetching and caching

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with custom blue theme
- **Database**: PostgreSQL with Prisma ORM
- **Data Fetching**: SWR for real-time polling
- **Deployment**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hackathon0825
   ```

2. **Start the application**
   ```bash
   # For local development with hot reloading
   docker-compose -f compose.local.yaml up --build

   # For production
   docker-compose -f compose.yaml up --build
   ```

3. **Access the application**
   - Open http://localhost:3000 in your browser
   - Enter a username to start chatting

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL
   ```

3. **Start PostgreSQL**
   ```bash
   docker run --name postgres-chat -e POSTGRES_PASSWORD=password -e POSTGRES_DB=chatapp -p 5432:5432 -d postgres:15-alpine
   ```

4. **Set up the database**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── app/
│   ├── actions.ts          # Server actions for database operations
│   ├── globals.css         # Global styles and Tailwind config
│   ├── layout.tsx          # Root layout component
│   └── page.tsx            # Main chat page
├── components/
│   ├── chat-area/          # Main chat interface
│   ├── sidebar/            # Chat rooms sidebar
│   └── username-modal/     # Username input modal
├── lib/
│   ├── prisma.ts          # Prisma client configuration
│   └── utils.ts           # Utility functions
└── types/
    └── index.ts           # TypeScript type definitions
```

## Database Schema

The application uses a simple schema with two main entities:

- **ChatRoom**: Represents chat rooms with name and timestamps
- **Message**: Stores messages with content, username, and room association

## Environment Variables

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/chatapp?schema=public"
```

## Docker Configuration

### Development (`compose.local.yaml`)
- Hot reloading enabled
- Volume mounts for live code changes
- Development-optimized build

### Production (`compose.yaml`)
- Optimized production build
- Multi-stage Docker build
- Persistent data volumes

## Features in Detail

### Real-time Updates
- Messages poll every 2 seconds
- Chat rooms poll every 5 seconds
- Optimistic updates for better UX

### Responsive Design
- Mobile-first approach
- Collapsible sidebar on desktop
- Mobile overlay menu
- Touch-friendly interface

### User Experience
- Username stored in localStorage
- Automatic room selection
- Message grouping by date
- Smooth animations and transitions

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema to database
npm run db:migrate   # Run database migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details