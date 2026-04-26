# CRAFT — Sistema de Inventario Cruz Roja Tandil

Sistema web para la gestión de equipamiento, insumos y morrales de la filial Tandil de Cruz Roja Argentina.

**Stack:** React + Vite · Vercel Serverless Functions · Supabase (PostgreSQL + Auth)

> **100% gratuito** — sin dependencias de APIs de pago. El registro de cambios usa
> un cuestionario guiado por sección y, opcionalmente, reconocimiento de voz nativo
> del navegador (Web Speech API, disponible en Chrome y Edge).

---

## Requisitos previos

- Node.js ≥ 18
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Cuenta en [Vercel](https://vercel.com) (gratuita)
- Repositorio en GitHub

---

## 1. Configurar Supabase

### 1.1 Crear el proyecto

1. Entrá a [supabase.com](https://supabase.com) → **New project**
2. Elegí una región cercana (ej. South America)
3. Anotá la contraseña de la base de datos

### 1.2 Ejecutar el schema

1. En el dashboard de Supabase → **SQL Editor** → **New query**
2. Copiá el contenido completo de `supabase/schema.sql`
3. Hacé clic en **Run**
4. Deberías ver "Success. No rows returned" — las tablas y el seed ya están listos

### 1.3 Obtener las claves

En **Project Settings → API**:

| Variable | Dónde encontrarla |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (mantener secreta) |

---

## 2. Crear el usuario administrador

El admin inicial se crea desde el dashboard de Supabase (nunca en el código):

1. En Supabase → **Authentication → Users → Add user → Create new user**
2. Completá email y contraseña temporal
3. Copiá el UUID del usuario recién creado
4. Ir a **SQL Editor** y ejecutar (reemplazando los valores):

```sql
INSERT INTO profiles (id, username, role, must_change_password)
VALUES (
  'UUID-DEL-USUARIO-AQUI',
  'tu.nombre',
  'admin',
  true
);
```

5. La próxima vez que inicie sesión, el sistema le pedirá cambiar la contraseña

---

## 3. Configurar variables de entorno en local

Copiá `.env.example` como `.env.local`:

```bash
cp .env.example .env.local
```

Completá con los valores reales de Supabase y Anthropic:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 4. Instalar dependencias y correr en local

```bash
npm install
npm run dev
```

La app estará en `http://localhost:5173`.

> **Nota:** Las Vercel Serverless Functions (`/api/*`) no corren con `npm run dev` en Vite. Para probarlas localmente instalá Vercel CLI:
> ```bash
> npm i -g vercel
> vercel dev
> ```

---

## 5. Deploy en Vercel

### 5.1 Conectar el repositorio

1. Subí el proyecto a GitHub (sin el archivo `.env.local`)
2. En [vercel.com](https://vercel.com) → **Add New Project**
3. Importá el repositorio de GitHub
4. Framework Preset: **Vite** (se detecta automáticamente)
5. Hacé clic en **Deploy**

### 5.2 Configurar variables de entorno en Vercel

En el dashboard de Vercel → **Settings → Environment Variables**, agregá:

| Nombre | Valor | Entornos |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de Supabase | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Anon key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Production, Preview, Development |

Luego en **Deployments → Redeploy** para que tome los cambios.

### 5.3 Deploy automático

Una vez conectado, cada `git push` a `main` dispara un deploy automático.

---

## 6. Crear usuarios voluntarios

Los administradores pueden crear usuarios desde la sección **Parámetros → Usuarios** dentro de la app:

1. Ir a **Parámetros → Usuarios**
2. Clic en **+ Nuevo usuario**
3. Completar email, nombre de usuario, contraseña temporal y rol
4. Al primer login, el sistema pedirá al usuario que cambie su contraseña

---

## Estructura del proyecto

```
├── api/
│   └── users.js           # Gestión de usuarios (Supabase Admin API)
├── src/
│   ├── components/
│   │   ├── AIInput.jsx    # Cuestionario guiado + Web Speech API (sin costo)
│   │   ├── ExportButton.jsx
│   │   ├── Header.jsx
│   │   ├── Layout.jsx
│   │   └── Sidebar.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useSupabase.js
│   ├── lib/
│   │   └── supabaseClient.js
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── ChangePassword.jsx
│   │   ├── Equipment.jsx
│   │   ├── Supplies.jsx
│   │   ├── Bags.jsx
│   │   └── Parameters.jsx
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   └── schema.sql         # Schema completo + seed data
├── .env.example
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

---

## Secciones

| Sección | Descripción | Admin | Voluntario |
|---|---|---|---|
| Equipamiento | Tabla agrupada por tipo, condición, observaciones | Editar condición/notas | Solo lectura |
| Insumos | Gráfico de faltantes + tabla con alertas de color | Editar stock actual | Solo lectura |
| Morrales | Cards por morral con % de completitud e ítems | Editar cantidades | Solo lectura |
| Parámetros | Stock ideal, tipos de morral, usuarios | ✓ | Acceso denegado |

---

## Notas de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` **nunca** va en el cliente: solo en las serverless functions donde no es accesible por el browser
- Row Level Security (RLS) está habilitado en todas las tablas
- Las operaciones de admin (crear usuarios, modificar roles) siempre pasan por `/api/users.js` que verifica el rol en el servidor
