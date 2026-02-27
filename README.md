# Productify: Multi-User Accountability & Productivity Platform

Productify is a comprehensive, AI-assisted productivity and habit-tracking web application designed to gamify accountability. It combines daily scheduling, real-time analytics, habit tracking, and dynamic "punishment backlogs" to ensure you stay on top of your daily goals. 

With built-in LeetCode API integration and AI-powered schedule pivoting, it acts as an intelligent assistant to dynamically adapt your workflow throughout the day.

## 🚀 Features

- **Multi-User Real-Time Dashboard**: Track your daily schedule flow across multiple users securely.
- **AI Schedule Pivoting**: Life happens. Ask the Groq AI engine to "pivot my schedule" and it will automatically clear out the afternoon and re-generate a new optimized timeline for the rest of the day based on your current constraints.
- **Punishment Backlog**: Missed tasks aren't forgotten. They are dynamically transferred to a dynamic "Backlog" queue. You must complete your backlog tasks before you regain access to scheduling leisure activities. 
- **LeetCode GraphQL Integration**: An active integration with the public LeetCode API allows you to monitor your daily accepted submissions and visualizes your coding consistency directly inside your analytics dashboard.
- **Comprehensive Analytics**: View completion rate trends, habit consistency (Water / Workouts), and pie chart breakdowns of completed vs. remaining tasks.
- **Deep Focus Mode**: A dedicated flow-state timer page designed for uninterrupted work.
- **Native Browser Notifications**: Get alerts 30 minutes and 10 minutes before an upcoming scheduled session begins.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, Recharts.
- **Backend / API**: Node.js, Express wrapped in **Netlify Functions** (`serverless-http`), **PostgreSQL** (`pg` pool).
- **Database**: Cloud-hosted **Supabase** (PostgreSQL) replace local SQLite for serverless scalability.
- **Authentication**: JWT token-based authentication (`jsonwebtoken`, `bcryptjs`).
- **AI Engine**: `groq-sdk` handling unstructured NLP generation.

## 💻 Running & Deploying Locally

### Prerequisites
- Node.js (v18+)
- A [Groq API Key](https://console.groq.com/keys)
- A [Supabase](https://supabase.com/) PostgreSQL database

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Stany87/Productify.git
   cd Productify
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-URL].supabase.co:5432/postgres
   JWT_SECRET=your_jwt_secret_key_here
   ```

4. **Initialize Database Schema:**
   *(Ensure you have executed the commands in `server/schema.sql` against your Supabase database either via the Supabase SQL Editor or a local migration script.)*

5. **Start the Netlify Dev Server:**
   This project uses Netlify Dev to automatically spin up both the Vite frontend and proxy the Node.js serverless backend.
   ```bash
   npx netlify dev
   ```

6. **Open in Browser:**
   Navigate to `http://localhost:8888` to access the full-stack application natively.

### 🌐 Deploying to Netlify (Production)

This project contains a `netlify.toml` file pre-configured for deployment. 
1. Push your code to GitHub.
2. Sign in to [Netlify](https://www.netlify.com/) and click **"Add new site" -> "Import an existing project"**.
3. Select your GitHub repository.
4. Add your `GROQ_API_KEY`, `DATABASE_URL`, and `JWT_SECRET` in the Netlify **Environment Variables** settings.
5. Click **Deploy Site**. Your backend API will automatically be hosted as Netlify Serverless Functions!
