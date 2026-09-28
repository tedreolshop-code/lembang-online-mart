-- ============================================================
-- MIGRASI v17 — index untuk pertumbuhan data
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================
-- Query yang sering dipakai saat data pesanan/pelanggan bertambah:
--   * cari pesanan per nomor HP pelanggan
--   * filter pesanan per status (laporan)
--   * hapus produk / laporan per produk (order_items.product_id)
--   * bersihkan riwayat stok saat pesanan/produk dihapus (stock_movements)
-- ============================================================

create index if not exists orders_customer_phone_idx on orders (customer_phone);
create index if not exists orders_status_idx on orders (status);
create index if not exists order_items_product_idx on order_items (product_id);
create index if not exists stock_movements_order_idx on stock_movements (order_id);
create index if not exists stock_movements_product_idx on stock_movements (product_id);
create index if not exists coupons_active_idx on coupons (active, expires_at);
