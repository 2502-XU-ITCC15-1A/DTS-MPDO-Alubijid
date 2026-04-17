# 🏛️ MPDO Document Tracking System

**Development and Integration of MPDO Documents Tracking System for the Municipality of Alubijid, Misamis Oriental**

A comprehensive, cloud-based document management and tracking solution designed to digitalize and streamline the Municipal Planning and Development Office (MPDO) workflows. Replaces manual, paper-based processes with transparent, efficient, and fully auditable digital tracking.

---

## 🎯 Overview

### Client Background

The **MPDO of Alubijid, Misamis Oriental** is responsible for municipal planning, coordination, and implementation of development projects. The office currently operates with **manual, paper-based workflows** that create significant operational challenges.

### Mission & Vision

**Mission:**  
To foster a productive and participatory community by empowering highly motivated civil servants dedicated to transparent and efficient local governance, thereby eradicating corruption and ensuring public trust.

**Vision:**  
To transform Alubijid into a progressive, well-governed community known for its operational excellence and integrity, achieved through cutting-edge systems for planning, monitoring, and service delivery.

### Project Scope

This system is a **Service Learning Project (SLP)** that provides the MPDO with a modern, integrated document tracking system to:

- Eliminate paper-based workflows
- Provide real-time document visibility
- Create comprehensive audit trails
- Ensure accountability and transparency

---

## ⚠️ Problem & Solution

### Current Challenges

1. **Manual Processes**  
   Personnel rely on paper-based workflows with no digital infrastructure

2. **Data Fragmentation**  
   Records scattered across physical documents and isolated spreadsheets—no centralized database

3. **Lack of Visibility**  
   Impossible to know where a document is, who has it, or how long it's been in process

4. **No Audit Trail**  
   Missing clear history of document movement, actions taken, and timestamps

5. **Inefficient Information Flow**  
   Deadlines and compliance not monitored → missed deadlines, data loss

**Key Staff Insight:** Staff explicitly expressed needing to "achieve the timestamp" to see **"where the paper stopped."**

### Solution Overview

A **three-tier, cloud-based system** that provides:

#### For MPDO Administrators

- ✅ Centralized document reception and encoding
- ✅ Auto-generate unique Document Tracking Numbers (DTN)
- ✅ Assign documents to staff with deadlines
- ✅ Comprehensive dashboard with filtering and statistics
- ✅ Approval workflows with revision capability
- ✅ Employee management and role assignment
- ✅ Complete audit trail visibility

#### For MPDO Staff

- ✅ View assigned documents only
- ✅ Update document status with auto-timestamping
- ✅ Upload file revisions and scans
- ✅ Receive notifications for new assignments
- ✅ Mark documents as complete
- ✅ Request approval for file updates

#### System-Wide

- ✅ Real-time status tracking (Pending → Processing → Approved → Released)
- ✅ Comprehensive audit logs with timestamps
- ✅ Role-based access control (Admin vs Staff)
- ✅ Secure file storage and authentication
- ✅ Document history and tracking
- ✅ Outgoing document management

---

## 👥 Team

| Name                         | Role                           | Email                    |
| ---------------------------- | ------------------------------ | ------------------------ |
| **Sandy Lumacad**            | Project Manager                | 200931990@my.xu.edu.ph   |
| **Joshua Argel B. Detchaca** | Systems Analyst / DB Design    | 20210021523@my.xu.edu.ph |
| **Emma Lene G. Ejera**       | QA / Testing                   | 20230027625@my.xu.edu.ph |
| **Rica Louise S. Mascunana** | Frontend Developer / UI Design | 200910045@my.xu.edu.ph   |
| **Ethan Dale B. Dosdos**     | Lead Backend Developer         | 20230027146@my.xu.edu.ph |

---

## 🛠️ Tech Stack

### Frontend

```
React.js (Vite)       → Component-based UI, fast development
Tailwind CSS          → Utility-first styling
TypeScript            → Type safety
Vercel                → Automated deployment
```

### Backend

```
Node.js               → Server runtime
Express.js            → REST API framework
TypeScript            → Type safety
Render                → API deployment
```

### Database & Auth

```
Supabase (PostgreSQL) → Managed database service
Supabase Auth         → JWT-based authentication
Row-Level Security    → Data access policies
Supabase Storage      → Cloud file storage
```

### DevOps & Tools

```
Docker                → Containerization (dev consistency)
Docker Compose        → Multi-container orchestration
GitHub                → Version control (GitHub Flow)
ClickUp               → Project management
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20+ (LTS)
- **Docker** & **Docker Compose**
- **Git**
- Code editor (VS Code recommended)
- Supabase account (free tier available)

### Quick Start (Docker - Recommended)

```bash
# 1. Clone repository
git clone https://github.com/your-org/PROJECT-ALUBIJID.git
cd PROJECT-ALUBIJID

# 2. Create environment files
# Copy .env.example files and fill in Supabase credentials

# 3. Start all services
docker-compose up --build

# 4. Access the application
# Frontend:  http://localhost:5173
# Backend:   http://localhost:5000/api
# Database:  Supabase dashboard (cloud)
```

### Manual Setup (Without Docker)

**Backend:**

```bash
cd backend
npm install
npm run dev                    # Runs on :5000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev                    # Runs on :5173
```

### Environment Variables

**backend/.env**

```env
NODE_ENV=development
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
DATABASE_URL=supabase_connection_string
```

**frontend/.env**

```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_key
```

---

## 📊 Document Workflow

### Incoming Documents

```
1. Receipt
   └─ Physical document received at MPDO

2. Digitization
   └─ Admin scans document, uploads digital copy

3. Encoding
   └─ Admin enters metadata (title, type, source)
   └─ DTN auto-generated with timestamp

4. Assignment
   └─ Admin assigns to staff member
   └─ Deadline specified

5. Processing
   └─ Staff receives notification
   └─ Status: "Processing"
   └─ Staff updates status as they work
   └─ All changes logged with timestamps

6. Review
   └─ Staff submits for admin approval
   └─ Admin reviews & decides:
      ├─ Approve → Release
      └─ Request revision → Send back to staff

7. Release
   └─ Document approved & released
   └─ Status: "Released" / "Completed"
   └─ Complete audit trail recorded
```

### Outgoing Documents

```
1. Creation
   └─ Admin creates outgoing document
   └─ Sets destination office

2. Assignment
   └─ Admin assigns to staff for processing

3. Processing
   └─ Staff prepares & uploads documents

4. Approval
   └─ Admin approves for release

5. Release
   └─ Document sent to destination
   └─ Audit trail complete
```

---

## 🚀 Deployment

### Development

**Using Docker:**

```bash
docker-compose up --build

# Services running:
# - Frontend:  http://localhost:5173
# - Backend:   http://localhost:5000
# - Database:  Supabase (cloud)
```

**Without Docker:**

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Production

**Architecture:**

- **Frontend:** Vercel (global CDN, automatic builds)
- **Backend:** Render (Node.js hosting, auto-scaling)
- **Database:** Supabase (cloud PostgreSQL)
- **Storage:** Supabase Storage Buckets

**Deployment Flow:**

```
Code pushed to main
    ↓
GitHub Actions runs tests (optional)
    ↓
Vercel auto-deploys frontend
    ↓
Render auto-deploys backend
    ↓
Database migrations run
    ↓
Production live
```

---

## 📜 License & Acknowledgments

### License

This project is developed for the **Local Government Unit of Alubijid, Misamis Oriental**.

All intellectual property and source code are exclusive to:

- LGU Alubijid
- Xavier University – Ateneo de Cagayan (Institution)
- Group 5 Development Team

### Acknowledgments

- **Local Government Unit of Alubijid** – Client, stakeholder, and partner
- **Xavier University – Ateneo de Cagayan** – Educational institution & advisors
- **Faculty Advisors:**
  - Ms. Guen Alexis Martinez Gabutin (ITCC 15)
  - Mr. Ian John Dolendo Alquitela (ITCC 16)
  - Mr. Wilbert T. Tan (ITCC 42)
- **Group 5 Members** – Development team & contributors

---

## 📞 Quick Links

- **Client Facebook:** [LGU Alubijid](https://www.facebook.com/lgualubijid.Info)
- **Project Location:** Alubijid, Misamis Oriental, Philippines
- **Supabase Docs:** https://supabase.com/docs
- **React + Vite:** https://vitejs.dev
- **Express.js:** https://expressjs.com
- **Docker:** https://docs.docker.com

---

## 🎓 About This Project

This project is developed as part of the **Xavier University – Ateneo de Cagayan Service Learning Program (SLP)**, demonstrating real-world software engineering practices including:

- Requirements analysis & gathering
- System architecture & design
- Full-stack web development
- Database design & security
- Testing & quality assurance
- Deployment & DevOps
- Client communication & project management

**Academic Context:**

- Course Sections: ITCC 15, ITCC 16, ITCC 42, CSCC 22
- Program: Bachelor of Science in Information Technology and Computer Science
- Institution: Xavier University – Ateneo de Cagayan

---

**Last Updated:** April 11, 2026  
**Next Review:** May 8, 2026  
**Questions?** Contact Sandy Lumacad (PM) or Ethan Dale B. Dosdos (Lead Dev)
