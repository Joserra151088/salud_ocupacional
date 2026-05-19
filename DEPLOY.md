# PREVITA OHP — Guía de despliegue en AWS (EC2 + RDS MySQL)

---

## Arquitectura

```
Internet → EC2 (Nginx + Node.js/PM2) → RDS MySQL
```

- **EC2:** sirve el frontend estático (index.html) y el backend API (Node.js)
- **Nginx:** reverse proxy en puerto 80/443 → Node.js en puerto 3000
- **RDS:** MySQL 8.x, accesible solo desde el Security Group de EC2

---

## Paso 1 — Preparar RDS MySQL

1. En AWS Console → RDS → "Create database"
2. Engine: **MySQL 8.0**
3. Template: Production (o Free tier para pruebas)
4. DB instance identifier: `previta-ohp-db`
5. Master username: `previta_admin`
6. Contraseña: guárdala en un lugar seguro
7. VPC: la misma que usará EC2
8. Public access: **No** (solo acceso interno desde EC2)
9. Crear un Security Group nuevo: `previta-rds-sg`
   - Inbound: MySQL/Aurora (3306) — Source: Security Group de EC2

Una vez creado, copia el **Endpoint** (algo como `previta-ohp-db.xxxx.us-east-1.rds.amazonaws.com`).

**Crear base de datos y usuario:**
```bash
# Desde EC2 o con un cliente MySQL con acceso temporal
mysql -h TU_ENDPOINT_RDS -u previta_admin -p

CREATE DATABASE previta_ohp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'previta_user'@'%' IDENTIFIED BY 'TU_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON previta_ohp.* TO 'previta_user'@'%';
FLUSH PRIVILEGES;
EXIT;
```

---

## Paso 2 — Lanzar EC2

1. AWS Console → EC2 → Launch instance
2. AMI: **Amazon Linux 2023** (o Ubuntu 22.04 LTS)
3. Tipo: `t3.small` o mayor
4. Security Group `previta-ec2-sg`:
   - Inbound: SSH (22) — solo tu IP
   - Inbound: HTTP (80) — 0.0.0.0/0
   - Inbound: HTTPS (443) — 0.0.0.0/0
5. Key pair: crea o reutiliza una existente
6. Elastic IP: asigna una IP elástica a la instancia

---

## Paso 3 — Configurar el servidor

Conéctate por SSH:
```bash
ssh -i tu-clave.pem ec2-user@TU_IP_ELASTICA
```

### Instalar Node.js 20, Nginx y PM2

```bash
# Node.js 20 (Amazon Linux 2023)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Ubuntu 22.04 alternativa:
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
# sudo apt-get install -y nodejs

# Nginx
sudo dnf install -y nginx       # Amazon Linux
# sudo apt-get install -y nginx  # Ubuntu

# PM2 (process manager para Node)
sudo npm install -g pm2
```

---

## Paso 4 — Subir el código

Desde tu máquina local, copia el proyecto al servidor:

```bash
# Instalar rsync si no lo tienes
# En la raíz del proyecto previta-ohp:

rsync -avz --exclude node_modules \
  ./backend \
  ec2-user@TU_IP_ELASTICA:/home/ec2-user/previta-ohp/

rsync -avz \
  ./frontend/index.html \
  ./frontend/favicon.svg \
  ec2-user@TU_IP_ELASTICA:/home/ec2-user/previta-ohp/frontend/
```

---

## Paso 5 — Instalar dependencias y configurar .env

```bash
# En el servidor
cd /home/ec2-user/previta-ohp/backend
npm install --production

# Crear archivo de configuración
cp .env.example .env
nano .env
```

Rellena el `.env` con tus datos reales:
```env
PORT=3000
NODE_ENV=production
DB_HOST=TU_ENDPOINT_RDS.rds.amazonaws.com
DB_PORT=3306
DB_USER=previta_user
DB_PASSWORD=TU_PASSWORD_SEGURO
DB_NAME=previta_ohp
JWT_SECRET=genera_una_cadena_aleatoria_de_64_caracteres_aqui
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://TU_DOMINIO.com
```

**Generar JWT_SECRET seguro:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Paso 6 — Aplicar el schema a RDS

```bash
cd /home/ec2-user/previta-ohp/backend
node src/db/migrate.js
```

Esto crea todas las tablas y el usuario admin inicial:
- **Email:** `admin@previta.org`
- **Contraseña:** `Admin1234!`
- **¡Cámbiala inmediatamente desde la API!**

---

## Paso 7 — Lanzar el backend con PM2

```bash
cd /home/ec2-user/previta-ohp/backend
pm2 start src/index.js --name previta-api
pm2 save
pm2 startup   # sigue las instrucciones que imprime para que arranque automático
```

Verificar que funciona:
```bash
curl http://localhost:3000/health
# Debe responder: {"status":"ok","ts":"..."}
```

---

## Paso 8 — Configurar Nginx

```bash
sudo nano /etc/nginx/conf.d/previta-ohp.conf
```

Pega esta configuración:
```nginx
server {
    listen 80;
    server_name TU_DOMINIO.com;   # o la IP elástica temporalmente

    # Frontend estático
    root /home/ec2-user/previta-ohp/frontend;
    index index.html;

    # API → Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Headers de seguridad
    add_header X-Frame-Options           DENY;
    add_header X-Content-Type-Options    nosniff;
    add_header Referrer-Policy           strict-origin-when-cross-origin;
    add_header Permissions-Policy        "microphone=(self)";
}
```

```bash
sudo nginx -t          # verificar configuración
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Paso 9 — HTTPS con Let's Encrypt (obligatorio)

```bash
# Amazon Linux 2023
sudo dnf install -y python3-certbot-nginx

# Ubuntu
# sudo apt-get install -y certbot python3-certbot-nginx

sudo certbot --nginx -d TU_DOMINIO.com
```

Certbot configura automáticamente HTTPS y redirige HTTP → HTTPS.
El certificado se renueva automáticamente.

---

## Paso 10 — Verificación final

- [ ] `https://TU_DOMINIO.com` carga la pantalla de login
- [ ] Login con `admin@previta.org` / `Admin1234!` funciona
- [ ] El dashboard carga vacío (sin datos demo)
- [ ] Crear un trabajador de prueba y verificar que persiste al recargar
- [ ] El botón ⏻ (logout) cierra la sesión correctamente
- [ ] `https://TU_DOMINIO.com/health` devuelve `{"status":"ok"}`

---

## Mantenimiento

```bash
# Ver logs del backend
pm2 logs previta-api

# Reiniciar backend (tras cambios)
pm2 restart previta-api

# Actualizar código
rsync -avz --exclude node_modules ./backend ec2-user@TU_IP:/home/ec2-user/previta-ohp/
pm2 restart previta-api

# Actualizar frontend
rsync -avz ./frontend/index.html ec2-user@TU_IP:/home/ec2-user/previta-ohp/frontend/
```

---

## Crear usuarios adicionales (vía API)

Una vez desplegado, usa un cliente HTTP (Postman, curl) para crear médicos:

```bash
# 1. Obtener token de admin
TOKEN=$(curl -s -X POST https://TU_DOMINIO.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@previta.org","password":"Admin1234!"}' \
  | jq -r .token)

# 2. Crear nuevo usuario
curl -X POST https://TU_DOMINIO.com/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Juan Pérez",
    "email": "jperez@empresa.com",
    "password": "Contrasena123!",
    "role": "doctor"
  }'
```

Roles disponibles: `admin`, `doctor`, `nurse`, `viewer`
