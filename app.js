import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6mr7_SuaFlc9R_kv8y9lc6rfKkMVv4-U",
  authDomain: "radiologyshift.firebaseapp.com",
  projectId: "radiologyshift",
  storageBucket: "radiologyshift.firebasestorage.app",
  messagingSenderId: "1085770244333",
  appId: "1:1085770244333:web:b7e635cb2f557bc26e6ce4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async function() {
    const calendarEl = document.getElementById('calendar');
    
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                let allEvents = [];
                let holidayEvents = [];

                // 1. ดึงข้อมูลวันหยุด (เพิ่มระบบป้องกันปฏิทินล่ม หาก API ไม่มีข้อมูล)
                try {
                    const year = new Date().getFullYear();
                    const holidayRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
                    
                    if (holidayRes.ok) {
                        const holidays = await holidayRes.json();
                        if (Array.isArray(holidays)) {
                            holidayEvents = holidays.map(h => ({
                                title: h.localName,
                                start: h.date,
                                display: 'background',
                                color: '#ffcccc',
                                textColor: '#ff0000'
                            }));
                        }
                    }
                } catch (apiError) {
                    console.warn("ไม่สามารถดึงข้อมูลวันหยุดได้ชั่วคราว:", apiError);
                }

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

                // รวมข้อมูลทั้งหมดส่งให้ปฏิทิน
                allEvents = [...holidayEvents, ...shiftEvents];
                successCallback(allEvents);
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการโหลดเวร:", error);
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

        saveBtn.innerText = "กำลังบันทึก...";

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

        saveBtn.innerText = "บันทึกข้อมูลเข้าปฏิทิน";
    });
});
