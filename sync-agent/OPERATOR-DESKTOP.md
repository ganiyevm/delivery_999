# Apteka999 Operator oynasi

Bu dastur qoldiq sinxronlash Windows Service'idan alohida ishlaydi. Yangi buyurtma kelganda F-Kassa va boshqa dasturlar ustidan katta ogohlantirish oynasini chiqaradi.

## Ishlash tartibi

- Backend har 5 soniyada tekshiriladi.
- Yangi buyurtmada oyna avtomatik ochiladi, taskbar yonadi va ovoz chiqadi.
- `Qabul qilish` qoldiqni bronlaydi va buyurtmani keyingi bosqichga o'tkazadi.
- `Rad etish` uchun sabab, batafsil izoh va mijozga qo'ng'iroq qilish tasdig'i majburiy.
- Oyna yopilsa dastur tray'da ishlashda davom etadi.

## Sozlamalar

Dastur birinchi navbatda `C:\sync-agent\.env` faylini o'qiydi. Unda quyidagilar bo'lishi kerak:

```env
BACKEND_URL=https://apteka999-production.up.railway.app
SYNC_API_KEY=backend_bilan_bir_xil_kalit
BRANCH_NUMBER=2
OPERATOR_NAME=Kassa xodimi
ORDER_POLL_SECONDS=5
```

`OPERATOR_API_KEY` berilsa, buyurtmalar uchun `SYNC_API_KEY` o'rniga shu alohida kalit ishlatiladi.

## Ishga tushirish

Tayyor `Apteka999-Operator-Setup-1.0.0.exe` faylini o'rnating. Dastur Windows bilan avtomatik ishga tushadi va tray'da `999` belgisi ko'rinadi.
