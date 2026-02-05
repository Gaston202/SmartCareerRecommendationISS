# Admin Dashboard - Smart Career Recommendation System

A modern, full-featured admin dashboard built with Next.js 15, TypeScript, and a carefully selected tech stack for optimal performance and developer experience.

## 🚀 Tech Stack

### Core Framework

- **Next.js 15** (App Router) - React framework with server-side rendering
- **React 19** - UI library
- **TypeScript** - Type-safe development

### Styling & UI

- **Tailwind CSS v4** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library built on Radix UI
- **lucide-react** - Icon library
- **Custom Theme** - Brand color `#7D10B9` (purple) integrated throughout

### State Management & Data Fetching

- **TanStack React Query** - Server state management with caching
- **Axios** - HTTP client with interceptors for authentication

### Forms & Validation

- **React Hook Form** - Performant form handling
- **Zod** - Schema validation (shared with mobile app)

### Authentication

- **NextAuth.js v5** - JWT-based authentication
- Role-based access control (RBAC)
- Secure session management

### Charts & Analytics

- **Recharts** - Composable charting library for data visualization

## 📁 Project Structure

```
admin-dashboard/
├── app/
│   ├── (auth)/                    # Auth route group (no layout)
│   │   └── login/
│   │       └── page.tsx           # Login page
│   │
│   ├── admin/                     # Protected admin routes
│   │   ├── layout.tsx             # Admin layout (Sidebar + Header)
│   │   ├── page.tsx               # Dashboard overview
│   │   ├── users/
│   │   │   └── page.tsx           # User management
│   │   ├── skills/
│   │   │   └── page.tsx           # Skills management
│   │   ├── careers/
│   │   │   └── page.tsx           # Careers management
│   │   ├── courses/
│   │   │   └── page.tsx           # Courses management
│   │   ├── recommendations/
│   │   │   └── page.tsx           # Recommendations view
│   │   └── analytics/
│   │       └── page.tsx           # Analytics & charts
│   │
│   ├── api/
│   │   └── auth/[...nextauth]/
│   │       └── route.ts           # NextAuth API route
│   │
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Home page (redirects to /admin)
│
├── components/
│   ├── ui/                        # shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx            # Navigation sidebar
│   │   └── Header.tsx             # Top header with search & user menu
│   ├── tables/                    # Reusable table components
│   ├── charts/                    # Chart components
│   └── forms/                     # Form components
│
├── services/
│   ├── api.ts                     # Axios instance with interceptors
│   └── auth.ts                    # Authentication service
│
├── hooks/
│   ├── use-api.ts                 # Generic API hooks
│   ├── useAuth.ts                 # Authentication hook
│   └── useUsers.ts                # User management hooks
│
├── types/
│   ├── user.ts                    # User type definitions
│   └── career.ts                  # Career, Skill, Course types
│
├── styles/
│   └── globals.css                # Global styles & Tailwind
│
├── lib/
│   ├── utils.ts                   # Utility functions
│   └── constants.ts               # App constants
│
├── providers/
│   └── query-provider.tsx         # React Query provider
│
├── auth.ts                        # NextAuth configuration
├── middleware.ts                  # Route protection
└── .env.local                     # Environment variables
```

## 🔧 Setup Instructions

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

1. **Navigate to the admin-dashboard directory**

   ```bash
   cd admin-dashboard
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   The `.env.local` file is already created. Update the values:

   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secure-secret-here
   ```

   Generate a secure `NEXTAUTH_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

4. **Run Development Server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## 🗺️ Navigation Structure

The admin dashboard is organized with a sidebar navigation:

- **Dashboard** (`/admin`) - Overview with KPIs and charts
- **Users** (`/admin/users`) - User management table
- **Skills** (`/admin/skills`) - Skills library management
- **Careers** (`/admin/careers`) - Career paths management
- **Courses** (`/admin/courses`) - Learning resources
- **Recommendations** (`/admin/recommendations`) - View sent recommendations
- **Analytics** (`/admin/analytics`) - Comprehensive analytics

## 🔑 Authentication

### Demo Login

Currently accepts any email and password (6+ characters) for demo purposes.

### Route Protection

- Login page: `/login` (route group `(auth)`)
- Protected routes: All routes under `/admin`
- Middleware automatically redirects unauthenticated users to login

### Connecting to Real Backend

Update `auth.ts`:

```typescript
async authorize(credentials) {
  const validatedFields = loginSchema.safeParse(credentials);

  if (!validatedFields.success) return null;

  const { email, password } = validatedFields.data;

  const response = await axios.post('YOUR_API_URL/auth/login', {
    email,
    password
  });

  return response.data; // Should return user object
}
```

## 📊 Data Fetching

### Using React Query Hooks

```typescript
// In your component
import { useUsers, useCreateUser } from "@/hooks/useUsers";

function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();

  const handleCreate = async (userData) => {
    await createUser.mutateAsync(userData);
  };

  return (/* Your JSX */);
}
```

### API Client

The Axios instance (`services/api.ts`) includes:

- Automatic request/response interceptors
- Auth token injection
- Error handling
- Base URL configuration

## 🎨 Styling & Theming

### Brand Colors

Configured in `styles/globals.css`:

```css
:root {
  --primary: #7d10b9;
  --accent: #9333ea;
}
```

### Using Tailwind Classes

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Button
</button>
```

### Adding shadcn/ui Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

Components will be added to `components/ui/`

## 📈 Charts with Recharts

Example from Analytics page:

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="users" stroke="#7D10B9" />
  </LineChart>
</ResponsiveContainer>;
```

## 🔐 Role-Based Access Control

Extend authentication for role-based access:

```typescript
// In your component
import { auth } from "@/auth";

export default async function AdminOnlyPage() {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    redirect("/unauthorized");
  }

  return <div>Admin content</div>;
}
```

## 📝 Forms

Example with React Hook Form + Zod:

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register("name")} />
      {errors.name && <span>{errors.name.message}</span>}

      <button type="submit">Submit</button>
    </form>
  );
}
```

## 🛠️ Development Scripts

```bash
npm run dev      # Start development server (port 3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

Ensure these are set in your production environment:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

### Recommended Platforms

- **Vercel** - Optimal for Next.js
- **Netlify** - Alternative with similar features
- **Docker** - For containerized deployments

## 📚 Key Features

✅ Server-side rendering with Next.js App Router  
✅ Route groups for auth layout separation  
✅ Protected routes with middleware  
✅ JWT-based authentication with NextAuth.js  
✅ Sidebar navigation with active state  
✅ Responsive layout (desktop-first)  
✅ Type-safe API calls with TypeScript  
✅ React Query for efficient data fetching  
✅ Recharts for data visualization  
✅ Form validation with Zod  
✅ Custom Tailwind theme with brand colors  
✅ shadcn/ui component library

## 📖 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [NextAuth.js](https://next-auth.js.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org/)
- [Lucide Icons](https://lucide.dev/)

## 📄 License

MIT License

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies**
