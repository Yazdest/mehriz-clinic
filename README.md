# راه‌اندازی سامانه نوبت‌دهی (نسخهٔ آزمایشی: Google Sheets + ایمیل)

1. فایل Google Sheet را باز کنید ← **Extensions ← Apps Script**.
2. محتوای فایل `apps-script/Code.gs` را در ویرایشگر جایگزین کنید و ذخیره کنید.
3. **Deploy ← New deployment ← Web app**: Execute as = **Me**، Who has access = **Anyone**. مجوزهای خواسته‌شده (Sheets و Gmail) را تأیید کنید.
4. آدرس Web App (که به `/exec` ختم می‌شود) را در `js/config.js` بگذارید.
5. سایت را روی هاست بگذارید یا برای تست `index.html` را باز کنید.

بعد از هر تغییر در Code.gs باید **Deploy ← Manage deployments ← Edit ← New version** بزنید.

نکات:
- ستون‌های تاریخ و ساعت در شیت‌ها باید **Plain text** بمانند (مثل 17:00 و 1405/08/25).
- سقف ایمیل: حساب Gmail معمولی حدود ۱۰۰ ایمیل در روز (هر رزرو = ۲ ایمیل). حساب Workspace بیشتر.
- فایل فونت Vazirmatn را بهتر است داخل سایت بگذارید تا بدون Google Fonts هم لود شود.
- شیت «کاربران» خودکار ساخته می‌شود و نام و موبایل بیماران را دارد؛ Share شیت را محدود کنید.
