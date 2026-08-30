-- ============================================================================
-- PANEL OSOBISTY - 0015_savings_target_date.sql
--
-- Termin celu oszczednosciowego — zeby liczyc, czy w obecnym tempie
-- (bilans miesiaca: dniowki minus wydatki minus raty) zdazysz uzbierac
-- zadana kwote do zadanej daty, i ile trzeba by odkladac miesiecznie,
-- zeby zdazyc.
--
-- Idempotentna.
-- ============================================================================

alter table public.savings_goal
  add column if not exists target_date date;
