# QA对校对协作平台部署教程

## 1. 引言

本教程旨在为用户提供一份从零到可用的QA对校对协作平台部署指南。该平台包括一个基于React的前端界面和一个基于Flask的后端API服务，并使用SQLite作为轻量级数据库，方便快速部署和测试。本教程将详细介绍在Ubuntu 22.04 LTS Server环境下部署该平台的所有必要步骤，包括系统环境准备、依赖安装、代码获取、数据库配置、应用启动和访问等。

## 2. 环境准备

在开始部署之前，请确保您的Ubuntu 22.04 LTS Server满足以下最低配置要求：

- **操作系统**: Ubuntu 22.04 LTS Server
- **CPU**: 4核
- **内存**: 8GB RAM
- **存储**: 20GB SSD硬盘空间

建议您使用干净的Ubuntu 22.04 LTS Server安装，以避免潜在的依赖冲突。在开始之前，请确保您的系统已更新到最新状态：

```bash
sudo apt update
sudo apt upgrade -y
```

## 3. 安装必要的系统依赖

QA对校对协作平台需要一些系统级别的依赖，包括Python、Node.js（用于前端构建）、Git（用于代码克隆）以及一些构建工具。请按照以下步骤安装这些依赖：

### 3.1 安装Python 3.8和pip

Ubuntu 20.04 LTS通常预装了Python 3，但我们建议安装Python 3.8以获得更好的兼容性和性能。同时，我们将安装`pip`，它是Python的包管理工具。

```bash
sudo apt update
sudo apt install -y python3.8 python3.8-venv python3-pip
```

### 3.2 安装Node.js和pnpm

前端部分使用Node.js环境进行构建。我们推荐使用`pnpm`作为包管理器，因为它更高效。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm
```

### 3.3 安装Git

我们将使用Git从代码仓库克隆项目。

```bash
sudo apt install -y git
```

## 4. 获取项目代码

您已获得项目代码，请确保所有文件位于 `/home/ubuntu/qa-proofreading-platform` 目录下。如果文件不在该目录，请手动移动。

```bash
cd /home/ubuntu/qa-proofreading-platform
```

## 5. 后端配置与启动

后端服务使用Flask框架，并配置为使用SQLite数据库，这使得部署过程无需额外安装和配置PostgreSQL数据库服务。所有数据将存储在项目目录下的`qa_proofreading.db`文件中。

### 5.1 创建并激活Python虚拟环境

为了隔离项目依赖，我们强烈建议使用Python虚拟环境。

```bash
python3.11 -m venv venv
source venv/bin/activate
```

### 5.2 安装后端依赖

激活虚拟环境后，安装后端所需的所有Python包。

```bash
pip install -r requirements.txt
```

### 5.3 初始化SQLite数据库

项目提供了一个脚本来初始化SQLite数据库并创建一些测试用户。在首次启动前，请运行此脚本。

```bash
python init_sqlite_db.py
```

### 5.4 启动后端服务

现在可以启动后端服务了。为了让服务在后台持续运行，我们使用`nohup`命令。

```bash
nohup python src/main.py > backend.log 2>&1 &
```

后端服务默认将在`http://0.0.0.0:5000`上监听请求。您可以通过查看`backend.log`文件来检查服务是否正常启动。

## 6. 前端配置与启动

前端应用使用React构建，需要先进行构建，然后才能通过后端服务进行访问。

### 6.1 安装前端依赖

进入前端项目目录，并使用`pnpm`安装所有JavaScript依赖。

```bash
cd frontend # 假设前端代码在项目根目录下的`frontend`子目录，请根据实际情况调整
pnpm install
```

### 6.2 构建前端应用

构建前端应用会生成静态文件，这些文件将被后端服务提供。

```bash
pnpm run build
```

构建完成后，生成的静态文件将位于`frontend/dist`目录。您需要将这些文件复制到后端服务的静态文件目录（通常是`backend/src/static`）。

```bash
cp -r frontend/dist/* ../backend/src/static/
```

### 6.3 访问平台

由于前端文件已经由后端Flask服务提供，您现在可以通过访问后端服务的地址来访问整个平台。

在您的浏览器中打开：

```
http://<您的服务器IP地址>:5000
```

您应该能看到登录页面。您可以选择已创建的测试用户登录，或者以访客模式体验单文件校对功能。

## 7. 常见问题与故障排除

### 7.1 端口占用

如果5000端口已被占用，您可能会在启动后端服务时看到错误。您可以通过以下命令检查端口占用情况：

```bash
sudo netstat -tulnp | grep 5000
```

如果端口被占用，您可以选择杀死占用进程，或者修改后端服务的端口（在`src/main.py`中修改`app.run`的`port`参数）。

### 7.2 权限问题

如果在执行某些命令时遇到权限错误，请确保您有足够的权限。对于需要root权限的命令，请使用`sudo`。

### 7.3 依赖安装失败

如果Python或Node.js依赖安装失败，请检查您的网络连接，并确保您的包管理器（pip或pnpm）已更新到最新版本。

## 8. 总结

通过本教程，您应该已经成功在Ubuntu 22.04 LTS Server上部署了QA对校对协作平台。该平台提供了一个用户友好的界面，用于管理和校对QA对数据。您可以根据需要进一步开发和扩展平台功能。

## 9. 参考资料

- [Ubuntu 22.04 LTS官方文档](https://ubuntu.com/download/server)
- [Flask官方文档](https://flask.palletsprojects.com/)
- [React官方文档](https://react.dev/)
- [pnpm官方文档](https://pnpm.io/)


