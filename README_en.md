# QA Proofreading Collaboration Platform V2

English | [中文](README.md)

## 📖 Project Introduction

The QA Proofreading Collaboration Platform is a web application designed for efficient management and collaborative proofreading of QA (Question-Answer) pairs. It aims to help team members review, edit, tag, and export large volumes of QA data, supporting both single-file proofreading and multi-user collaborative tasks.

## ✨ Key Features

### 🔐 User Authentication and Management
- **User Login**: Supports login via a pre-configured user list, distinguishing between administrators and regular users
- **Session Management**: Users obtain a session token upon login for subsequent API request authentication
- **Permission Control**: Provides different operational permissions based on user roles (super admin, admin, regular user) and task assignments

### 📄 Single-File Proofreading
- **File Upload**: Supports uploading JSONL formatted QA pair files for proofreading
- **QA Pair List Display**: Displays QA pairs in a paginated list, with keyword search support
- **QA Pair Editing**: Allows modification of Prompt and Completion for individual QA pairs, and supports marking them for deletion
- **Data Export**: Supports exporting proofread QA pairs to JSONL or Excel format

### 👥 Collaborative Task Management
- **Task Creation**: Administrators can upload JSONL files to create collaborative proofreading tasks and assign them to multiple users
- **Task Assignment**: Supports assigning QA pairs by quantity to different team members
- **Task Progress Tracking**: View overall task progress and individual member completion status
- **Collaborative Editing**: Team members can edit the QA pairs assigned to them
- **Task Submission**: Members can submit their task portions after completing their assigned QA pairs
- **Merge and Export**: Task creators can merge all submitted task portions and export them to JSONL or Excel format

### 📋 Task List
- **Pending Tasks**: Displays the current user's pending single-file proofreading tasks and collaborative tasks
- **Completed Tasks**: Displays the current user's completed tasks and provides links to download exported files

### ⚙️ System Administration (Reserved)
- **User Group Management**: Administrators can create, edit, and delete user groups
- **Admin Group Management**: Administrators can create, edit, and delete administrator groups
- **Data Traceability**: View editing history and operation logs of QA pairs

## 🛠️ Technology Stack

### Frontend
- **Framework**: React.js
- **UI Components**: Ant Design (inferred from package.json, actual code uses lucide-react and tailwind-merge, possibly combined with Tailwind CSS)
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS, PostCSS

### Backend
- **Framework**: Flask
- **Database**: SQLAlchemy (ORM), SQLite (default for development, configurable to PostgreSQL)
- **API**: RESTful API
- **Authentication**: JWT (PyJWT)
- **Caching**: Redis (reserved, inferred from requirements.txt)
- **File Handling**: openpyxl (Excel)
- **Others**: Flask-CORS, Werkzeug, python-dotenv, bcrypt

## 🏗️ System Architecture

The system adopts a front-end and back-end separation architecture, communicating via RESTful APIs. Core components include:

- **User Layer**: Administrator users, regular users, guest users
- **Frontend Layer**: React-based web application, providing user interface and interaction logic
- **Network Layer**: Nginx reverse proxy (optional), HTTPS/SSL encryption
- **Backend Layer**: Flask-based API service, handling business logic, data storage, and file operations
- **Data Layer**: PostgreSQL database (or SQLite), Redis cache, local file system for file storage
- **External Services**: Scheduled cleanup tasks, data backup services (reserved)

## 🚀 Deployment Guide

### Overview

This document provides detailed guidance for the deployment and testing of the QA Proofreading Collaboration Platform. The platform adopts a front-end and back-end separation architecture, with the front-end based on React and the back-end based on Flask. This guide will cover setting up the development environment, installing dependencies, initializing the database, and starting the services.

> **Important Note**: This guide assumes you are deploying in a Linux (Ubuntu) environment. All commands are executed in the terminal. Please ensure your system meets all prerequisites.

### Environment Preparation

Before starting the deployment, please ensure your system has the following software and tools installed:

#### Operating System
- Ubuntu 20.04 LTS or higher (recommended)

#### Core Dependencies

**Git**: Used for cloning project code
```bash
sudo apt update
sudo apt install git -y
```

**Python 3.9 or higher**: Backend service runtime environment
```bash
sudo apt install python3.9 python3.9-venv python3-pip -y
# Ensure pip points to python3.9
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.9 1
sudo update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1
```

**Node.js 18.x or higher**: Frontend build and runtime environment
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
# Verify installation
node -v
npm -v
```

**npm or Yarn**: Frontend package manager
```bash
sudo npm install -g yarn # If you choose to use yarn
```

### Project Deployment

#### 1. Obtaining Project Code

First, you need to clone the project code from your version control system (e.g., Git repository) to your local machine. If you have obtained the project via a compressed package, please extract it to your desired deployment directory.

```bash
# If it's a Git repository, please replace with your actual repository URL
git clone <Your Project Git Repository URL>
cd qa-proofreading-platform
```

> If you obtained the project via a compressed package, please ensure you have extracted it and your current terminal's working directory is within the extracted `qa-proofreading-platform` directory. All subsequent paths in this guide will be relative to this root directory.

#### 2. Backend Service Deployment

The backend service uses the Python Flask framework. Here are the deployment steps:

**Create and Activate Python Virtual Environment**

To isolate project dependencies, it is highly recommended to use a virtual environment.

```bash
python3 -m venv venv
source venv/bin/activate
```

> **Note**: On Windows systems, the activation command might be `.\venv\Scripts\activate`.

**Install Backend Dependencies**

After activating the virtual environment, install all Python packages listed in `requirements.txt`.

```bash
pip install -r requirements.txt
```

**Database Initialization**

The platform defaults to using SQLite for development and testing. The database file will be generated in the `instance/` directory. You need to run the initialization script to create the database table structure and populate initial data.

```bash
python init_sqlite_db.py
```

After running this script, you will see output similar to the following, which includes default login credentials:

```
正在删除旧的数据库表...
旧表已删除。
正在创建新的数据库表...
新表已成功创建。
正在填充初始数据...
数据库初始化数据填充完成。
-----------------------------------------
初始用户凭据:
  - 超级管理员: superadmin / password
  - 管理员: adminuser / password
  - 普通用户: user1 / password, user2 / password
-----------------------------------------
```

> **Note**: If you need to use a production-grade database like PostgreSQL, please modify the database configuration in `src/config.py` and ensure the corresponding database driver (e.g., `psycopg2-binary`) is installed. This guide does not detail PostgreSQL configuration.

**Start Backend Service**

In the activated virtual environment, run the Flask application.

```bash
python src/main.py
```

The backend service will default to running on `http://localhost:5001`. You should see Flask's startup information.

> **Tip**: If you want the backend service to run continuously in the background, you can use tools like `nohup` or `screen/tmux`, or use WSGI servers like Gunicorn in a production environment.

#### 3. Frontend Service Deployment

The frontend service is built using React and Vite. Here are the deployment steps:

**Navigate to Frontend Project Directory**

Depending on the project structure, the frontend code might be in the project root directory or a `frontend/` subdirectory. Based on the compressed package content you provided, the frontend files are directly in the project root.

```bash
# If you are not currently in the project root, please navigate back first
# cd /path/to/qa-proofreading-platform
```

**Install Frontend Dependencies**

Use npm or yarn to install the necessary JavaScript dependencies for the frontend project.

```bash
npm install
# Or
# yarn install
```

**Start Frontend Development Server**

Use Vite to start the frontend development server. This will compile the frontend code and serve it locally.

```bash
npm run dev
# Or
# yarn dev
```

The frontend development server will default to running on `http://localhost:5173`. Vite will automatically open your browser and navigate to this address.

#### 4. Accessing the Platform

Once both the backend and frontend services have successfully started, you can access the platform by visiting the frontend address in your browser:

**Platform Access Address**: `http://localhost:5173`

You can use the default user credentials provided during database initialization for login and testing.

### Production Environment Deployment Suggestions (Optional)

For production environment deployment, it is recommended to take the following measures to improve performance, stability, and security:

**Use Gunicorn as WSGI server**: Replace Flask's built-in development server.

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5001 src.main:app
```

**Use Nginx as a reverse proxy**: Handle static files, load balancing, and HTTPS.
- Configure Nginx to forward all `/api/v1` requests to the backend Gunicorn service
- Configure Nginx to serve the built static files of the frontend
- Configure SSL certificates to enable HTTPS

**Frontend Production Build**: Run `npm run build` (or `yarn build`) command to generate optimized static files, then serve these files via Nginx or similar web servers.

```bash
npm run build
```

Built files are usually located in the `dist/` directory.

**Database**: Replace SQLite with a more powerful relational database like PostgreSQL.

**Log Management**: Configure backend logs to output to files or a logging service for easy monitoring and troubleshooting.

**Environment Variables**: Use more secure mechanisms to manage sensitive configurations (e.g., database connection strings, secrets) instead of hardcoding them directly.

### Common Issues and Troubleshooting

- **Port Occupancy**: If the frontend or backend service fails to start, indicating that the port is already in use, you can try modifying the port number in `vite.config.js` (frontend) or `src/main.py` (backend), or find and terminate the process occupying the port.

- **Dependency Installation Failure**: Check your network connection, or try changing the npm/pip mirror source.

- **Database Connection Error**: Ensure the database service is running and the connection string is configured correctly.

- **Frontend Blank Screen**: Check the browser console for JavaScript errors, ensure the backend service is started and API requests are normal.

- **Permission Issues**: Ensure your user has read and write permissions for the project directory, especially when installing dependencies and creating files.

## 📚 API Interface Documentation

For detailed API interface specifications, please refer to the `api_specification.md` file.

## 🤝 Contribution and Development

### Development Environment Setup

**Clone Repository**
```bash
git clone <repository URL>
cd qa-proofreading-platform
```

**Backend Environment Setup**

Create and activate Python virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows
```

Install backend dependencies:
```bash
pip install -r requirements.txt
```

Initialize database:
```bash
python init_sqlite_db.py
```

Run backend service:
```bash
python src/main.py
```

Backend service defaults to running on `http://localhost:5001`.

**Frontend Environment Setup**

Navigate to frontend directory:
```bash
cd frontend  # If frontend code is in a separate frontend directory
# Or execute directly in the project root, if frontend files are in the root directory
```

Install frontend dependencies:
```bash
npm install
# Or yarn install
```

Run frontend service:
```bash
npm run dev
# Or yarn dev
```

Frontend service defaults to running on `http://localhost:5173`.

### Project Structure

```
qa-proofreading-platform/
├── api.js                      # Frontend API call encapsulation
├── api_specification.md        # Backend API interface documentation
├── App.css                     # Global CSS styles
├── App.jsx                     # React main application component
├── CHANGELOG.md                # Change log
├── components/                 # React component directory
├── database_design.sql         # Database design SQL script
├── data_flow.mmd               # Data flow diagram definition file
├── data_flow.png               # Data flow diagram image
├── docs/                       # Documentation directory
│   ├── qa-proofreading-prd.md  # Product requirements document
│   └── 部署测试指南.md         # Deployment and testing guide
├── exports/                    # Exported files directory
├── frontend/                   # Frontend project root directory (if exists)
├── hooks/                      # React Hooks
├── image.png                   # Project screenshot/diagram
├── index.html                  # Frontend HTML entry file
├── init_sqlite_db.py           # Database initialization script
├── instance/                   # Flask instance configuration and SQLite database files
├── lib/                        # Helper libraries or utility functions
├── logs/                       # Log files directory
├── main.jsx                    # React application entry
├── node_modules/               # Frontend dependencies
├── package-lock.json           # Frontend dependency lock file
├── package.json                # Frontend project configuration
├── pasted_content.txt          # Example of pasted content
├── postcss.config.js           # PostCSS configuration
├── README.md                   # Project README file (current file)
├── requirements.txt            # Backend Python dependencies
├── src/                        # Backend source code directory
│   ├── config.py               # Configuration management
│   ├── main.py                 # Flask application entry
│   ├── models/                 # Database model definitions
│   ├── routes/                 # API route definitions
│   └── static/                 # Static files (if frontend built here)
├── system_architecture.mmd     # System architecture diagram definition file
├── system_architecture.png     # System architecture diagram image
├── tailwind.config.js          # Tailwind CSS configuration
├── test_data.jsonl             # Test data
├── test_qa_data.jsonl          # Test QA data
├── uploads/                    # Uploaded files directory
├── useAuth.js                  # Authentication related Hook
└── venv/                       # Python virtual environment
```

## 📝 Change Log

Please refer to the `CHANGELOG.md` file.

## 📄 License

[Fill in license information here, e.g., MIT License]

