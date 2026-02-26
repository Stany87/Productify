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

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion (for fluid animations), Recharts (for analytics dashboards), React Router.
- **Backend / API**: Node.js, Express, `better-sqlite3` (with WAL mode enabled for high concurrency).
- **Authentication**: JWT token-based authentication (`jsonwebtoken`, `bcryptjs`).
- **AI Engine**: `groq-sdk` handling unstructured NLP generation.

## 💻 Running Locally

### Prerequisites
- Node.js (v18+)
- A [Groq API Key](https://console.groq.com/keys)

### Setup Instructions

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
   Create a `.env` file in the `server/` directory and add your Groq API Key:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   PORT=3001
   ```

4. **Start the Frontend & Backend Servers (Concurrent):**
   ```bash
   npm run dev
   # (in a separate terminal)
   node server/index.js
   ```

5. **Open in Browser:**
   Navigate to `http://localhost:5173` to access the application.
