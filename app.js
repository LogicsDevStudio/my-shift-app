import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    // *** นำ Config ของคุณมาใส่ตรงนี้ ***
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async function() {
    const calendarEl = document.getElementById('calendar');
    
    // สร้างตัวแปรปฏิทิน
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th', // ตั้งค่าภาษาไทย
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                let allEvents = [];

                // 1. ดึงข้อมูลวันหยุดจาก API (ปีปัจจุบัน)
                const year = new Date().getFullYear();
                const holidayRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
                const holidays = await holidayRes.json();
                const holidayEvents = holidays.map(h => ({
                    title: h.localName,
                    start: h.date,
                    display: 'background',
                    color: '#ffcccc', // สีพื้นหลังวันหยุด
                    textColor: '#ff0000'
                }));

                // 2. ดึงข้อมูลเวรจาก Firebase
                const querySnapshot = await getDocs(collection(db, "shifts"));
                const shiftEvents = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        title: data.shiftName,
                        start: data.date,
                        backgroundColor: data.bgColor,
                        extendedProps: { time: data.time }
                    };
                });

                // รวมข้อมูลทั้งหมด
                allEvents = [...holidayEvents, ...shiftEvents];
                successCallback(allEvents);
            } catch (error) {
                console.error(error);
                failureCallback(error);
            }
        },
        eventClick: function(info) {
            if (info.event.extendedProps.time) {
                alert(info.event.title + "\nเวลา: " + info.event.extendedProps.time);
            } else {
                alert(info.event.title);
            }
        }
    });

    calendar.render();

    // ระบบบันทึกข้อมูล
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', async () => {
        const date = document.getElementById('dateInput').value;
        const shiftSelect = document.getElementById('shiftInput');
        const shiftName = shiftSelect.value;
        const shiftTime = shiftSelect.options[shiftSelect.selectedIndex].dataset.time;
        const shiftColor = shiftSelect.options[shiftSelect.selectedIndex].dataset.color;

        if (!date) return alert("กรุณาเลือกวันที่");

        try {
            await addDoc(collection(db, "shifts"), {
                date: date,
                shiftName: shiftName,
                time: shiftTime,
                bgColor: shiftColor
            });
            alert("บันทึกสำเร็จ!");
            calendar.refetchEvents(); // อัปเดตปฏิทินทันที
        } catch (e) {
            alert("Error: " + e);
        }
    });
});
