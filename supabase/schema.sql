-- ============================================================
-- CRAFT — Cruz Roja Tandil
-- Schema completo + seed. Ejecutar en Supabase SQL Editor.
-- Es idempotente: se puede re-ejecutar sin errores.
-- ============================================================

-- ── EXTENSIONS ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                TEXT UNIQUE NOT NULL,
  role                 TEXT CHECK (role IN ('admin', 'volunteer')) DEFAULT 'volunteer',
  branch_name          TEXT DEFAULT 'Tandil',
  must_change_password BOOLEAN DEFAULT true,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment (
  id            SERIAL PRIMARY KEY,
  type          TEXT NOT NULL,
  item_number   TEXT,
  year_acquired TEXT,
  condition     TEXT CHECK (condition IN ('good', 'damaged', 'unknown')) DEFAULT 'good',
  notes         TEXT,
  has_id        BOOLEAN DEFAULT false,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplies (
  id            SERIAL PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,
  ideal_stock   INTEGER NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  unit          TEXT DEFAULT 'unidades',
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bag_types (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS bag_type_items (
  id             SERIAL PRIMARY KEY,
  bag_type_id    INTEGER REFERENCES bag_types(id) ON DELETE CASCADE,
  item_name      TEXT NOT NULL,
  ideal_quantity INTEGER NOT NULL,
  UNIQUE (bag_type_id, item_name)
);

CREATE TABLE IF NOT EXISTS bags (
  id           SERIAL PRIMARY KEY,
  bag_number   TEXT NOT NULL,
  bag_type_id  INTEGER REFERENCES bag_types(id),
  condition    TEXT CHECK (condition IN ('complete', 'incomplete', 'damaged')) DEFAULT 'complete',
  notes        TEXT,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (bag_number, bag_type_id)
);

CREATE TABLE IF NOT EXISTS bag_contents (
  id               SERIAL PRIMARY KEY,
  bag_id           INTEGER REFERENCES bags(id) ON DELETE CASCADE,
  item_name        TEXT NOT NULL,
  ideal_quantity   INTEGER NOT NULL,
  current_quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bag_id, item_name)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id),
  action_type TEXT,
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment    ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_type_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper: checks if the calling user has role='admin'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ── POLICIES ─────────────────────────────────────────────────

-- Drop existing policies to allow re-run
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','equipment','supplies','bag_types',
                        'bag_type_items','bags','bag_contents','activity_log')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "profiles_insert_service" ON profiles FOR INSERT TO service_role WITH CHECK (true);

-- equipment
CREATE POLICY "equipment_select" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_insert" ON equipment FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "equipment_update" ON equipment FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "equipment_delete" ON equipment FOR DELETE TO authenticated USING (is_admin());

-- supplies
CREATE POLICY "supplies_select" ON supplies FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplies_insert" ON supplies FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "supplies_update" ON supplies FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "supplies_delete" ON supplies FOR DELETE TO authenticated USING (is_admin());

-- bag_types
CREATE POLICY "bag_types_select" ON bag_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "bag_types_all"    ON bag_types FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- bag_type_items
CREATE POLICY "bag_type_items_select" ON bag_type_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "bag_type_items_all"    ON bag_type_items FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- bags
CREATE POLICY "bags_select" ON bags FOR SELECT TO authenticated USING (true);
CREATE POLICY "bags_all"    ON bags FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- bag_contents
CREATE POLICY "bag_contents_select" ON bag_contents FOR SELECT TO authenticated USING (true);
CREATE POLICY "bag_contents_all"    ON bag_contents FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- activity_log
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity_log_delete" ON activity_log FOR DELETE TO authenticated USING (is_admin());

-- ── SEED: SUPPLIES ────────────────────────────────────────────

INSERT INTO supplies (name, ideal_stock, current_stock, unit) VALUES
  ('Guantes S',              200, 143, 'unidades'),
  ('Guantes M',              200,   2, 'unidades'),
  ('Guantes L',              200, 155, 'unidades'),
  ('Gasas',                  200,  64, 'unidades'),
  ('Apósitos',               200, 187, 'unidades'),
  ('Curitas',                200, 102, 'unidades'),
  ('Cinta hipoalergénica',    10,   4, 'unidades'),
  ('Vendas 5cm',             200,  78, 'unidades'),
  ('Vendas 7cm',             200,  38, 'unidades'),
  ('Vendas 10cm',            200, 160, 'unidades'),
  ('Bolsa de vómito',         50,  34, 'unidades'),
  ('Bolsa patológicos',       50,  17, 'unidades'),
  ('Solución fisiológica',    35,  17, 'unidades'),
  ('Agua oxigenada 100cm3',   12,   1, 'unidades'),
  ('Iodo povidona 100cm3',    12,   3, 'unidades'),
  ('Algispray',                8,   8, 'unidades'),
  ('Repelente',                6,   2, 'unidades'),
  ('Planillas de atención',  300,  75, 'unidades'),
  ('Termómetro',               5,   3, 'unidades'),
  ('Tensiómetro',              5,   2, 'unidades'),
  ('Oxímetro',                 3,   2, 'unidades'),
  ('Tijera de trauma',         4,   1, 'unidades'),
  ('Tijera punta redonda',     4,   4, 'unidades'),
  ('Baja lenguas',           170,  55, 'unidades'),
  ('Vaselina',               200,  57, 'unidades'),
  ('Linterna',                 2,   1, 'unidades'),
  ('Azúcar (sobres)',        200, 100, 'unidades'),
  ('Sal (sobres)',           200,  81, 'unidades'),
  ('Alcohol en gel',          30,  25, 'unidades'),
  ('Tapones auditivos',       15,   0, 'unidades'),
  ('Vasos descartables',     100,  56, 'unidades'),
  ('Revolvedores',           250, 177, 'unidades')
ON CONFLICT (name) DO NOTHING;

-- ── SEED: EQUIPMENT ──────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM equipment LIMIT 1) THEN
    INSERT INTO equipment (type, item_number, year_acquired, condition, notes, has_id) VALUES
      -- Morrales (7 numerados + 1 SC)
      ('Morral', '1',  NULL,   'good', NULL,              true),
      ('Morral', '2',  NULL,   'good', NULL,              true),
      ('Morral', '3',  NULL,   'good', NULL,              true),
      ('Morral', '4',  NULL,   'good', NULL,              true),
      ('Morral', '5',  NULL,   'good', NULL,              true),
      ('Morral', '6',  NULL,   'good', NULL,              true),
      ('Morral', '7',  NULL,   'good', NULL,              true),
      ('Morral', 'SC', '2025', 'good', NULL,              true),
      -- Bolso de trauma
      ('Bolso de trauma', '1', '2025', 'good',    NULL,              true),
      ('Bolso de trauma', '2', '2025', 'damaged', 'Rota la manija',  true),
      ('Bolso de trauma', '3', '2025', 'good',    NULL,              true),
      ('Bolso de trauma', '4', '2026', 'good',    NULL,              true),
      ('Bolso de trauma', '5', '2026', 'good',    NULL,              true),
      -- Mochila térmica
      ('Mochila térmica', '1', '2026', 'good', NULL, true),
      ('Mochila térmica', '2', '2026', 'good', NULL, true),
      ('Mochila térmica', '3', '2026', 'good', NULL, true),
      ('Mochila térmica', '4', '2026', 'good', NULL, true),
      ('Mochila térmica', '5', '2026', 'good', NULL, true),
      -- Mochila (2, sin año)
      ('Mochila', NULL, NULL, 'good', NULL, false),
      ('Mochila', NULL, NULL, 'good', NULL, false),
      -- Tabla amarilla (3, sin año)
      ('Tabla amarilla', NULL, NULL, 'good', NULL, false),
      ('Tabla amarilla', NULL, NULL, 'good', NULL, false),
      ('Tabla amarilla', NULL, NULL, 'good', NULL, false),
      -- Sin número
      ('Casco',  NULL, NULL, 'good', NULL, false),
      ('Manta',  NULL, NULL, 'good', NULL, false),
      -- Catres
      ('Catre', '1', '2026', 'good', NULL, true),
      ('Catre', '2', '2026', 'good', NULL, true),
      ('Catre', '3', '2026', 'good', NULL, true),
      ('Catre', '4', '2026', 'good', NULL, true),
      ('Catre', '5', '2026', 'good', NULL, true),
      -- Mesas
      ('Mesa redonda',     NULL, NULL, 'good', NULL, false),
      ('Mesa rectangular', NULL, NULL, 'good', NULL, false),
      -- Varios sin número
      ('Tacho de basura',    NULL, NULL, 'good', NULL, false),
      ('Silla plástica',     NULL, NULL, 'good', NULL, false),
      ('Silla tipo sillón',  NULL, NULL, 'good', NULL, false),
      ('Caja de luz',        NULL, NULL, 'good', NULL, false),
      ('Alargue',            NULL, NULL, 'good', NULL, false),
      -- Zapatilla eléctrica (2)
      ('Zapatilla eléctrica', '1', NULL, 'good', NULL, true),
      ('Zapatilla eléctrica', '2', NULL, 'good', NULL, true),
      -- Varios
      ('Porta focos', NULL, NULL, 'good', NULL, false),
      ('Foco',        NULL, NULL, 'good', NULL, false);
  END IF;
END $$;

-- ── SEED: BAG TYPES ──────────────────────────────────────────

INSERT INTO bag_types (name) VALUES
  ('Morral estándar'),
  ('Morral de trauma'),
  ('Caja de atención')
ON CONFLICT (name) DO NOTHING;

-- ── SEED: BAG TYPE ITEMS — Morral estándar ───────────────────

INSERT INTO bag_type_items (bag_type_id, item_name, ideal_quantity)
SELECT bt.id, v.item_name, v.qty
FROM bag_types bt
CROSS JOIN (VALUES
  ('Guantes S', 20), ('Guantes M', 20), ('Guantes L', 20),
  ('Gasas', 20), ('Apósitos', 5), ('Curitas', 20),
  ('Cinta hipoalergénica', 3),
  ('Vendas 5cm', 5), ('Vendas 7cm', 5), ('Vendas 10cm', 5),
  ('Bolsa de vómito', 3), ('Bolsa patológicos', 2),
  ('Solución fisiológica', 3), ('Agua oxigenada', 3), ('Iodo povidona', 3),
  ('Algispray', 1), ('Repelente', 1),
  ('Planillas de atención', 10),
  ('Termómetro', 1), ('Tensiómetro', 1), ('Oxímetro', 1),
  ('Tijera de trauma', 1), ('Tijera punta redonda', 1),
  ('Baja lenguas', 5), ('Vaselina', 8), ('Linterna', 1),
  ('Azúcar (sobres)', 5), ('Sal (sobres)', 5),
  ('Alcohol en gel', 1), ('Tapones auditivos', 2),
  ('Vasos descartables', 2), ('Revolvedores', 2)
) AS v(item_name, qty)
WHERE bt.name = 'Morral estándar'
ON CONFLICT (bag_type_id, item_name) DO NOTHING;

-- ── SEED: BAG TYPE ITEMS — Morral de trauma (doble) ──────────

INSERT INTO bag_type_items (bag_type_id, item_name, ideal_quantity)
SELECT bt.id, v.item_name, v.qty
FROM bag_types bt
CROSS JOIN (VALUES
  ('Guantes S', 40), ('Guantes M', 40), ('Guantes L', 40),
  ('Gasas', 40), ('Apósitos', 10), ('Curitas', 40),
  ('Cinta hipoalergénica', 6),
  ('Vendas 5cm', 10), ('Vendas 7cm', 10), ('Vendas 10cm', 10),
  ('Bolsa de vómito', 6), ('Bolsa patológicos', 4),
  ('Solución fisiológica', 6), ('Agua oxigenada', 6), ('Iodo povidona', 6),
  ('Algispray', 2), ('Repelente', 2),
  ('Planillas de atención', 20),
  ('Termómetro', 2), ('Tensiómetro', 2), ('Oxímetro', 2),
  ('Tijera de trauma', 2), ('Tijera punta redonda', 2),
  ('Baja lenguas', 10), ('Vaselina', 16), ('Linterna', 2),
  ('Azúcar (sobres)', 10), ('Sal (sobres)', 10),
  ('Alcohol en gel', 2), ('Tapones auditivos', 4),
  ('Vasos descartables', 4), ('Revolvedores', 4)
) AS v(item_name, qty)
WHERE bt.name = 'Morral de trauma'
ON CONFLICT (bag_type_id, item_name) DO NOTHING;

-- ── SEED: BAG TYPE ITEMS — Caja de atención (igual a estándar)

INSERT INTO bag_type_items (bag_type_id, item_name, ideal_quantity)
SELECT bt.id, v.item_name, v.qty
FROM bag_types bt
CROSS JOIN (VALUES
  ('Guantes S', 20), ('Guantes M', 20), ('Guantes L', 20),
  ('Gasas', 20), ('Apósitos', 5), ('Curitas', 20),
  ('Cinta hipoalergénica', 3),
  ('Vendas 5cm', 5), ('Vendas 7cm', 5), ('Vendas 10cm', 5),
  ('Bolsa de vómito', 3), ('Bolsa patológicos', 2),
  ('Solución fisiológica', 3), ('Agua oxigenada', 3), ('Iodo povidona', 3),
  ('Algispray', 1), ('Repelente', 1),
  ('Planillas de atención', 10),
  ('Termómetro', 1), ('Tensiómetro', 1), ('Oxímetro', 1),
  ('Tijera de trauma', 1), ('Tijera punta redonda', 1),
  ('Baja lenguas', 5), ('Vaselina', 8), ('Linterna', 1),
  ('Azúcar (sobres)', 5), ('Sal (sobres)', 5),
  ('Alcohol en gel', 1), ('Tapones auditivos', 2),
  ('Vasos descartables', 2), ('Revolvedores', 2)
) AS v(item_name, qty)
WHERE bt.name = 'Caja de atención'
ON CONFLICT (bag_type_id, item_name) DO NOTHING;

-- ── SEED: BAGS 1–7 (Morral estándar) con contenido completo ──

DO $$
DECLARE
  morral_type_id INTEGER;
  new_bag_id     INTEGER;
  i              INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bags LIMIT 1) THEN
    SELECT id INTO morral_type_id FROM bag_types WHERE name = 'Morral estándar';

    FOR i IN 1..7 LOOP
      INSERT INTO bags (bag_number, bag_type_id, condition)
      VALUES (i::TEXT, morral_type_id, 'complete')
      RETURNING id INTO new_bag_id;

      INSERT INTO bag_contents (bag_id, item_name, ideal_quantity, current_quantity)
      SELECT new_bag_id, bti.item_name, bti.ideal_quantity, bti.ideal_quantity
      FROM bag_type_items bti
      WHERE bti.bag_type_id = morral_type_id;
    END LOOP;
  END IF;
END $$;
