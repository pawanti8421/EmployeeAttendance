# 🏢 AttendanceOS — MongoDB Atlas Edition

A complete attendance management system built with **Node.js + Express**, **MongoDB Atlas**, and a clean vanilla HTML/CSS/JS frontend.

---

## 📁 Folder Structure

```
attendance-system/
│
├── server.js                    ← Express entry point
├── package.json
├── .env.example                 ← Copy to .env and fill in your values
├── .gitignore
├── README.md
│
├── config/
│   └── db.js                    ← MongoDB Atlas connection (Mongoose)
│
├── middleware/
│   └── auth.js                  ← requireAuth / requireAdmin guards
│
├── models/
│   ├── User.js                  ← Mongoose User schema (bcrypt pre-save hook)
│   └── Attendance.js            ← Mongoose Attendance schema
│
├── routes/
│   ├── auth.js                  ← POST /login  POST /logout  GET /me
│   ├── users.js                 ← POST /add-user  GET /users
│   └── attendance.js            ← /mark-in  /mark-out  /attendance/:id  /all-attendance
│
├── public/                      ← Static frontend (served by Express)
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
│
└── database/
    └── seed.js                  ← Seed default admin + sample users
```

---

## 🍃 MongoDB Data Models

### Users Collection
```js
{
  _id:       ObjectId,
  name:      String,        // required
  email:     String,        // required, unique, lowercase
  password:  String,        // bcrypt hashed (10 rounds)
  role:      "admin"|"user",
  createdAt: Date,
  updatedAt: Date
}
```

### Attendance Collection
```js
{
  _id:        ObjectId,
  user:       ObjectId,     // ref → Users
  date:       String,       // "YYYY-MM-DD" (unique per user)
  inTime:     Date,
  outTime:    Date,
  totalHours: Number,       // decimal, e.g. 8.50 = 8h 30m
  createdAt:  Date,
  updatedAt:  Date
}
// Index: { user: 1, date: 1 } unique  ← prevents double check-in
```

---

## 🔌 REST API Reference

| Method | Endpoint                    | Auth        | Description                        |
|--------|-----------------------------|-------------|------------------------------------|
| POST   | `/api/login`                | Public      | Login with email + password        |
| POST   | `/api/logout`               | Any         | Destroy session                    |
| GET    | `/api/me`                   | Any         | Return current session user        |
| POST   | `/api/add-user`             | Admin only  | Create a new employee              |
| GET    | `/api/users`                | Admin only  | List all employees                 |
| POST   | `/api/mark-in`              | User/Admin  | Record clock-in time               |
| POST   | `/api/mark-out`             | User/Admin  | Record clock-out + calc hours      |
| GET    | `/api/attendance/:user_id`  | Owner/Admin | Get records for one user           |
| GET    | `/api/all-attendance`       | Admin only  | Get all records (all users)        |
| GET    | `/api/today-status`         | User/Admin  | Check today's in/out status        |

---

## ⚙️ Step-by-Step Setup

### Step 1 — Install dependencies

```bash
cd attendance-system
npm install
```

---

### Step 2 — Create a MongoDB Atlas cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **Sign up / Log in**
2. Click **Build a Database** → choose **M0 Free Tier**
3. Pick a cloud provider + region (any) → click **Create**
4. **Security Quickstart**:
   - Create a database user (e.g. `attendanceUser` / strong password)
   - Add your IP to the access list (or `0.0.0.0/0` for open access in dev)
5. Click **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://attendanceUser:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

---

### Step 3 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb+srv://attendanceUser:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority
PORT=3000
SESSION_SECRET=any_long_random_string_here
NODE_ENV=development
```

> Replace `YOUR_PASSWORD`, `cluster0.xxxxx` with your actual values.
> The database `attendance_db` is created automatically on first write.

---

### Step 4 — Seed the database

```bash
npm run seed
```

This creates:

| Role  | Email               | Password    |
|-------|---------------------|-------------|
| Admin | admin@company.com   | admin123    |
| User  | alice@company.com   | password123 |
| User  | bob@company.com     | password123 |
| User  | carol@company.com   | password123 |

---

### Step 5 — Run locally

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Open **http://localhost:3000**

---

## ☁️ Deploy to Any Hosting Platform

### Option A — Railway (easiest, free tier)

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up

# Set env vars in Railway dashboard or:
railway variables set MONGODB_URI="..." SESSION_SECRET="..."
```

### Option B — Render.com (free tier)

1. Push this repo to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in the Render dashboard

### Option C — Azure App Service

```bash
az webapp create --name your-app --runtime "NODE:18-lts" ...
az webapp config appsettings set --settings MONGODB_URI="..." SESSION_SECRET="..."
```

### Option D — Heroku

```bash
heroku create your-app-name
heroku config:set MONGODB_URI="..." SESSION_SECRET="..."
git push heroku main
```

---

## 🧪 Testing with curl

```bash
# Login
curl -c cookie.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}'

# Mark IN
curl -b cookie.txt -X POST http://localhost:3000/api/mark-in

# Mark OUT
curl -b cookie.txt -X POST http://localhost:3000/api/mark-out

# My attendance
curl -b cookie.txt http://localhost:3000/api/attendance/<your_user_id>

# All attendance (admin)
curl -b cookie.txt http://localhost:3000/api/all-attendance

# Add user (admin)
curl -b cookie.txt -X POST http://localhost:3000/api/add-user \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@company.com","password":"pass123","role":"user"}'
```

---

## 📦 Dependencies

| Package          | Purpose                              |
|------------------|--------------------------------------|
| express          | HTTP server and routing              |
| mongoose         | MongoDB ODM (schema + queries)       |
| bcryptjs         | Password hashing (10 salt rounds)    |
| express-session  | Server-side session cookies          |
| cors             | Cross-Origin Resource Sharing        |
| dotenv           | Load .env into process.env           |

---

## 🐛 Troubleshooting

**`MongoServerError: bad auth`**
→ Wrong password in MONGODB_URI. Re-check Atlas → Database Access.

**`MongooseServerSelectionError`**
→ Your IP is not whitelisted. Go to Atlas → Network Access → Add IP.

**Session lost on server restart**
→ Expected with in-memory sessions. Use `connect-mongo` for persistent sessions:
```bash
npm install connect-mongo
```
```js
const MongoStore = require('connect-mongo');
app.use(session({
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  ...
}));
```

**Port already in use**
→ Change `PORT=3001` in `.env`
