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

// ตัวแปรเก็บข้อมูลทั้งหมด เพื่อใช้ในการคำนวณสรุปผล
let allShiftsData = [];
let allHolidaysData = [];

document.addEventListener('DOMContentLoaded', async function() {
    const calendarEl = document.getElementById('calendar');
    
    // ฟังก์ชันอัปเดตสรุปเวรและวันหยุดตามเดือนที่แสดงบนปฏิทิน
    function updateSidebarInfo(currentDate) {
        const currentMonth = currentDate.getMonth(); // 0-11
        const currentYear = currentDate.getFullYear();
        
        // 1. อัปเดตชื่อเดือนในส่วนสรุป
        const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        document.getElementById('summaryMonthTitle').innerText = `${monthNames[currentMonth]} ${currentYear + 543}`;

        // 2. คำนวณสรุปเวร
        let cMorning = 0, cAfternoon = 0, cNight = 0, cOff = 0;
        
        allShiftsData.forEach(shift => {
            const shiftDate = new Date(shift.date);
            if(shiftDate.getMonth() === currentMonth && shiftDate.getFullYear() === currentYear) {
                if(shift.shiftName === "เวรเช้า") cMorning++;
                else if(shift.shiftName === "เวรบ่าย") cAfternoon++;
                else if(shift.shiftName === "เวรดึก") cNight++;
                else if(shift.shiftName === "ออฟ (Off)") cOff++;
            }
        });

        document.getElementById('countMorning').innerText = cMorning;
        document.getElementById('countAfternoon').innerText = cAfternoon;
        document.getElementById('countNight').innerText = cNight;
        document.getElementById('countOff').innerText = cOff;

        // 3. แสดงรายชื่อวันหยุดของเดือนนั้น
        const holidayListEl = document.getElementById('holidayList');
        holidayListEl.innerHTML = ""; // ล้างข้อมูลเก่า
        let hasHoliday = false;

        allHolidaysData.forEach(holiday => {
            const holDate = new Date(holiday.date);
            if(holDate.getMonth() === currentMonth && holDate.getFullYear() === currentYear) {
                hasHoliday = true;
                const li = document.createElement('li');
                li.className = "list-group-item d-flex justify-content-between align-items-center";
                li.innerHTML = `<span>${holDate.getDate()} ${monthNames[currentMonth]}</span> <span class="badge bg-danger rounded-pill">${holiday.localName}</span>`;
                holidayListEl.appendChild(li);
            }
        });

        if(!hasHoliday) {
            holidayListEl.innerHTML = `<li class="list-group-item text-muted text-center">ไม่มีวันหยุดราชการในเดือนนี้</li>`;
        }
    }

    // สร้างปฏิทิน
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth'
        },
        datesSet: function(info) {
            // เมื่อผู้ใช้เปลี่ยนเดือน ให้คำนวณข้อมูลใหม่
            updateSidebarInfo(info.view.currentStart);
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                let calendarEvents = [];
                
                // โหลดวันหยุด (ทำครั้งเดียวหรือตามปี)
                try {
                    const year = new Date().getFullYear();
                    const holidayRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
                    if (holidayRes.ok) {
                        allHolidaysData = await holidayRes.json();
                        const holidayEvents = allHolidaysData.map(h => ({
                            title: h.localName,
                            start: h.date,
                            display: 'background',
                            color: '#ffe6e6'
                        }));
                        calendarEvents = calendarEvents.concat(holidayEvents);
                    }
                } catch (e) { console.warn("API วันหยุดมีปัญหา", e); }

                // โหลดเวรจาก Firebase
                const querySnapshot = await getDocs(collection(db, "shifts"));
                allShiftsData = querySnapshot.docs.map(doc => doc.data());
                
                const shiftEvents = allShiftsData.map(data => ({
                    title: data.shiftName,
                    start: data.date,
                    backgroundColor: data.bgColor,
                    extendedProps: { time: data.time }
                }));
                
                calendarEvents = calendarEvents.concat(shiftEvents);
                
                // ส่งข้อมูลให้ปฏิทินแสดงผล
                successCallback(calendarEvents);
                
                // อัปเดตข้อมูลด้านข้างทันทีที่โหลดข้อมูลครั้งแรกเสร็จ
                updateSidebarInfo(calendar.getDate());

            } catch (error) {
                console.error(error);
                failureCallback(error);
            }
        },
        eventClick: function(info) {
            if (info.event.extendedProps.time && info.event.extendedProps.time !== "-") {
                alert(info.event.title + "\nเวลา: " + info.event.extendedProps.time);
            } else {
                alert(info.event.title);
            }
        }
    });

    calendar.render();

    // ฟังก์ชันบันทึกเวร
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', async () => {
        const date = document.getElementById('dateInput').value;
        const shiftSelect = document.getElementById('shiftInput');
        const shiftName = shiftSelect.value;
        const shiftTime = shiftSelect.options[shiftSelect.selectedIndex].dataset.time;
        const shiftColor = shiftSelect.options[shiftSelect.selectedIndex].dataset.color;

        if (!date) return alert("กรุณาเลือกวันที่ก่อนบันทึกครับ");

        saveBtn.innerText = "⏳ กำลังบันทึก...";
        saveBtn.disabled = true;

        try {
            await addDoc(collection(db, "shifts"), {
                date: date,
                shiftName: shiftName,
                time: shiftTime,
                bgColor: shiftColor
            });
            alert("✅ บันทึกข้อมูลสำเร็จ!");
            calendar.refetchEvents(); // สั่งให้ปฏิทินและกล่องสรุปดึงข้อมูลใหม่
        } catch (e) {
            alert("❌ เกิดข้อผิดพลาด: " + e);
        }

        saveBtn.innerText = "บันทึกข้อมูล";
        saveBtn.disabled = false;
    });
});
