import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let calendar;
let allHolidays = [];
let allShiftsData = []; // เก็บเวรทั้งหมดแบบ Realtime
let shiftTypesList = []; // เก็บประเภทเวร

// ตัวแปรสำหรับปฏิทินและเวรด่วน
let currentSelectedDate = "";
let currentSelectedShiftType = null; // ตัวแปรเก็บเวรที่ถูกคลิกเลือกใน Modal
let isFastAddMode = false;
let fastAddCurrentDate = null;

document.addEventListener('DOMContentLoaded', async function() {
    await loadHolidays(); // โหลดวันหยุดครั้งเดียวก่อนเริ่มระบบ
    initSettingsView();
    initCalendarView();
    listenToShifts(); // เปิดการติดตามข้อมูลเวรแบบ Realtime
});

// โหลดข้อมูลวันหยุด
async function loadHolidays() {
    try {
        const year = new Date().getFullYear();
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
        if(res.ok && res.status !== 204) {
            const text = await res.text();
            if(text && text.trim().length > 0) {
                allHolidays = JSON.parse(text);
            }
        }
    } catch(e) { console.warn("ไม่สามารถโหลดวันหยุดได้", e); }
}

// ติดตามตารางเวรแบบ Realtime (แทนการโหลดซ้ำ)
function listenToShifts() {
    onSnapshot(collection(db, "shifts"), (snapshot) => {
        allShiftsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if(calendar) {
            calendar.refetchEvents(); // อัปเดตปฏิทินทันที
            updateSidebarSummary(calendar.view.currentStart); // อัปเดตยอดสรุปทันที
        }
    });
}

// --- ฟังก์ชันจัดการ Fast Add (ลงเวรด่วน) ---
window.openFastAddModal = () => {
    // เซ็ตค่าเริ่มต้นเป็นวันปัจจุบัน
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('fastAddStartDate').value = localDate;
    
    new bootstrap.Modal(document.getElementById('fastAddDateModal')).show();
};

window.startFastAdd = () => {
    const dateVal = document.getElementById('fastAddStartDate').value;
    if(!dateVal) return alert('กรุณาเลือกวันเริ่มต้นลงเวร');
    
    // แปลงสตริงวันที่กลับเป็น Date object (ปลอดภัยจาก Timezone)
    const parts = dateVal.split('-');
    fastAddCurrentDate = new Date(parts[0], parts[1] - 1, parts[2]);

    bootstrap.Modal.getInstance(document.getElementById('fastAddDateModal')).hide();
    
    isFastAddMode = true;
    document.getElementById('fastAddBar').classList.remove('d-none');
    updateFastAddLabel();
};

window.toggleFastAdd = (show) => {
    isFastAddMode = show;
    const bar = document.getElementById('fastAddBar');
    if(!show) bar.classList.add('d-none');
};

function updateFastAddLabel() {
    const label = document.getElementById('fastAddDateLabel');
    if(label) {
        label.innerText = fastAddCurrentDate.toLocaleDateString('th-TH', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
    }
}

// บันทึกเวรด่วนและเลื่อนวันอัตโนมัติ
async function handleFastAdd(typeData) {
    const localDate = new Date(fastAddCurrentDate.getTime() - (fastAddCurrentDate.getTimezoneOffset() * 60000));
    const dateStr = localDate.toISOString().split('T')[0];
    
    await addDoc(collection(db, "shifts"), {
        date: dateStr,
        name: typeData.name,
        color: typeData.color,
        time: typeData.hasTime ? `${typeData.start}-${typeData.end}` : "",
        note: ""
    });

    fastAddCurrentDate.setDate(fastAddCurrentDate.getDate() + 1);
    updateFastAddLabel();
}

// --- ส่วนหน้าการจัดการประเภทเวร (Shift Settings) ---
function initSettingsView() {
    const saveTypeBtn = document.getElementById('saveTypeBtn');
    
    // บันทึกประเภทเวร
    saveTypeBtn.addEventListener('click', async () => {
        const toggleTime = document.getElementById('toggleTime');
        const typeName = document.getElementById('typeName');
        const typeColor = document.getElementById('typeColor');
        
        const data = {
            name: typeName.value,
            color: typeColor.value,
            hasTime: toggleTime.checked,
            start: toggleTime.checked ? document.getElementById('startTime').value : "",
            end: toggleTime.checked ? document.getElementById('endTime').value : ""
        };
        if(!data.name) return alert("ระบุชื่อเวร");
        
        await addDoc(collection(db, "shiftTypes"), data);
        typeName.value = "";
        alert("เพิ่มประเภทเวรสำเร็จ");
    });

    // ดึงประเภทเวรมาแสดง (Realtime) และสร้างปุ่มใน Modal
    onSnapshot(collection(db, "shiftTypes"), (snapshot) => {
        const list = document.getElementById('shiftTypeList');
        const modalButtons = document.getElementById('modalShiftButtons'); // แทนที่ Select เดิม
        const fastAddButtons = document.getElementById('fastAddButtons'); 
        
        list.innerHTML = "";
        if(modalButtons) modalButtons.innerHTML = "";
        if(fastAddButtons) fastAddButtons.innerHTML = "";
        shiftTypesList = []; 
        
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const id = docSnap.id;
            shiftTypesList.push({ id, ...t });
            
            // 1. หน้าตั้งค่า
            const item = document.createElement('div');
            item.className = "list-group-item d-flex justify-content-between align-items-center border-0 mb-2 shadow-sm rounded-3";
            item.innerHTML = `<div><span class="badge" style="background:${t.color}">&nbsp;</span> <b>${t.name}</b> ${t.hasTime ? `<small>(${t.start}-${t.end})</small>` : ""}</div>
                              <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteType('${id}')">ลบ</button>`;
            list.appendChild(item);

            // 2. สร้างปุ่มเวรด่วน
            if(fastAddButtons) {
                const btnFast = document.createElement('button');
                btnFast.className = "btn text-white fw-bold text-nowrap";
                btnFast.style.backgroundColor = t.color;
                btnFast.innerText = t.name;
                btnFast.onclick = () => handleFastAdd(t);
                fastAddButtons.appendChild(btnFast);
            }

            // 3. สร้างปุ่มใน Modal เลือกเวรรายวัน
            if(modalButtons) {
                const btnModal = document.createElement('button');
                btnModal.className = "btn text-white fw-bold shift-btn";
                btnModal.style.backgroundColor = t.color;
                btnModal.style.opacity = "0.4"; // ตั้งค่าโปร่งแสงเป็นค่าเริ่มต้น
                btnModal.innerText = t.name;
                
                // จัดการเวลากดปุ่มใน Modal
                btnModal.onclick = () => {
                    // ล้าง opacity ของทุกปุ่ม
                    document.querySelectorAll('.shift-btn').forEach(b => b.style.opacity = "0.4");
                    // ทำให้ปุ่มที่ถูกคลิกสว่างขึ้น
                    btnModal.style.opacity = "1";
                    currentSelectedShiftType = { id, ...t }; // เก็บค่าไว้รอเซฟ
                };
                modalButtons.appendChild(btnModal);
            }
        });
        
        if(calendar) updateSidebarSummary(calendar.view.currentStart);
    });
}

window.deleteType = async (id) => {
    if(confirm("ยืนยันการลบประเภทเวรนี้?")) await deleteDoc(doc(db, "shiftTypes", id));
};

// --- ส่วนหน้าปฏิทิน (Calendar View) ---
function initCalendarView() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
        dateClick: function(info) {
            currentSelectedDate = info.dateStr;
            document.getElementById('modalDateLabel').innerText = info.dateStr;
            
            // รีเซ็ตสถานะปุ่มใน Modal
            document.querySelectorAll('.shift-btn').forEach(b => b.style.opacity = "0.4");
            currentSelectedShiftType = null; 
            document.getElementById('modalNote').value = "";
            
            new bootstrap.Modal(document.getElementById('addEventModal')).show();
        },
        datesSet: (info) => updateSidebarSummary(info.view.currentStart),
        events: function(info, successCallback) {
            // ดึงข้อมูล Realtime มาผสมกับวันหยุดแล้วแสดงผลทันที
            const holEvents = allHolidays.map(h => ({ start: h.date, display: 'background', color: '#ffcccc' }));
            const shiftEvents = allShiftsData.map(d => ({
                id: d.id,
                title: d.name,
                start: d.date,
                backgroundColor: d.color,
                extendedProps: { shiftId: d.id, note: d.note || "" }
            }));
            successCallback([...holEvents, ...shiftEvents]);
        },
        eventClick: async function(info) {
            if(info.event.display === 'background') return;
            const noteText = info.event.extendedProps.note ? `\nโน้ต: ${info.event.extendedProps.note}` : "";
            
            if(confirm(`เวร: ${info.event.title}${noteText}\n\nต้องการลบเวรนี้ออกจากปฏิทินใช่หรือไม่?`)) {
                await deleteDoc(doc(db, "shifts", info.event.extendedProps.shiftId));
            }
        }
    });
    calendar.render();
}

// บันทึกเวรลงวันที่คลิก (จากปุ่มกดแทน Dropdown)
document.getElementById('modalSaveBtn').addEventListener('click', async () => {
    if(!currentSelectedShiftType) {
        return alert("กรุณาเลือกประเภทเวรก่อนบันทึก");
    }

    const noteInput = document.getElementById('modalNote').value;
    
    await addDoc(collection(db, "shifts"), {
        date: currentSelectedDate,
        name: currentSelectedShiftType.name,
        color: currentSelectedShiftType.color,
        time: currentSelectedShiftType.hasTime ? `${currentSelectedShiftType.start}-${currentSelectedShiftType.end}` : "",
        note: noteInput
    });
    
    bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
    // ไม่ต้องสั่ง calendar.refetchEvents() เองแล้ว เพราะ onSnapshot จัดการให้ Realtime!
});

// สรุปข้อมูลข้างปฏิทิน
function updateSidebarSummary(startDate) {
    if(!startDate) return;
    
    const m = startDate.getMonth();
    const y = startDate.getFullYear();
    
    const summary = {};
    shiftTypesList.forEach(type => { summary[type.name] = 0; });
    
    // ใช้อาร์เรย์แบบ Realtime แทนการ Fetch ใหม่
    allShiftsData.forEach(data => {
        const dDate = new Date(data.date);
        if(dDate.getMonth() === m && dDate.getFullYear() === y) {
            if(summary.hasOwnProperty(data.name)) {
                summary[data.name]++;
            } else {
                summary[data.name] = 1;
            }
        }
    });

    const sumBox = document.getElementById('summaryList');
    if(sumBox) {
        sumBox.innerHTML = "";
        Object.keys(summary).forEach(key => {
            sumBox.innerHTML += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom border-light">
                    <span class="small fw-bold">${key}</span> 
                    <span class="badge text-white rounded-pill" style="background:#555;">${summary[key]}</span>
                </div>`;
        });
    }

    // อัปเดตวันหยุด
    const holBox = document.getElementById('holidayList');
    if(holBox) {
        holBox.innerHTML = "";
        allHolidays.forEach(h => {
            const hDate = new Date(h.date);
            if(hDate.getMonth() === m && hDate.getFullYear() === y) {
                holBox.innerHTML += `<li class="list-group-item small d-flex justify-content-between text-muted"><span>${hDate.getDate()} - ${h.localName}</span></li>`;
            }
        });
    }
}
