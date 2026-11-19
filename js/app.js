
"use strict";

// تنظیمات اصلی سامانه درمانگاه فرهنگیان مهریز
const ClinicApp = {
    config: {
        name: "درمانگاه فرهنگیان مهریز",
        timezone: "Asia/Tehran",
        calendar: "persian",
        language: "fa"
    },

    init() {
        console.log("سامانه نوبت‌دهی درمانگاه آماده اجراست.");
        this.setCurrentYear();
    },

    setCurrentYear() {
        const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            year: "numeric"
        });

        console.log("سال جاری:", date.format(new Date()));
    }
};

// اجرای اولیه
document.addEventListener("DOMContentLoaded", () => {
    ClinicApp.init();
});
