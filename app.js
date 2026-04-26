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
let currentSelectedDate = "";

document.addEventListener('DOMContentLoaded', function() {
    initSettingsView();
    initCalendarView();
});

// --- ส่วนหน้าการจัดการประเภทเวร (Shift Settings) ---
function initSettingsView() {
    const toggleTime = document.getElementById('toggleTime');
    const timeSection = document.getElementById('timeInputSection');
    const typeName = document.getElementById('typeName');
    const typeColor = document.getElementById('typeColor');
    const preview = document.getElementById('previewEvent');
    const saveTypeBtn = document.getElementById('saveTypeBtn');

    // อัปเดตตัวอย่าง
    const updatePreview = () => {
        preview.innerText = typeName.value || "ชื่อเวร";
        preview.style.backgroundColor = typeColor.value;
    };
    typeName.addEventListener('input', updatePreview);
    typeColor.addEventListener('input', updatePreview);
    toggleTime.addEventListener('change', () => {
        timeSection.style.display = toggleTime.checked ? 'block' : 'none';
    });

    // บันทึกประเภทเวร
    saveTypeBtn.addEventListener('click', async () => {
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

    // ดึงประเภทเวรมาแสดงผล (Realtime)
    onSnapshot(collection(db, "shiftTypes"), (snapshot) => {
        const list = document.getElementById('shiftTypeList');
        const modalSelect = document.getElementById('modalShiftSelect');
        list.innerHTML = "";
        modalSelect.innerHTML = "<option value=''>-- เลือกเวร --</option>";
        
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const id = docSnap.id;
            
            // ใส่ในหน้าตั้งค่า
            const item = document.createElement('div');
            item.className = "list-group-item d-flex justify-content-between align-items-center border-0 mb-2 shadow-sm rounded-3";
            item.innerHTML = `<div><span class="badge" style="background:${t.color}">&nbsp;</span> <b>${t.name}</b> ${t.hasTime ? `<small>(${t.start}-${t.end})</small>` : ""}</div>
                              <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteType('${id}')">ลบ</button>`;
            list.appendChild(item);

            // ใส่ใน Modal เลือกเวร
            const opt = document.createElement('option');
            opt.value = id;
            opt.dataset.name = t.name;
            opt.dataset.color = t.color;
            opt.dataset.time = t.hasTime ? `${t.start}-${t.end}` : "";
            opt.innerText = t.name;
            modalSelect.appendChild(opt);
        });
    });
}

// ฟังก์ชันลบประเภทเวร (ประกาศให้เรียกจาก HTML ได้)
window.deleteType = async (id) => {
    if(confirm("ยืนยันการลบประเภทเวรนี้?")) await deleteDoc(doc(db, "shiftTypes", id));
};

// --- ส่วนหน้าปฏิทิน (Calendar View) ---
async function initCalendarView() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
        dateClick: function(info) {
            currentSelectedDate = info.dateStr;
            document.getElementById('modalDateLabel').innerText = info.dateStr;
            new bootstrap.Modal(document.getElementById('addEventModal')).show();
        },
        datesSet: (info) => updateSidebarSummary(info.view.currentStart),
        events: async function(info, successCallback) {
            // โหลดวันหยุด
            try {
                const year = new Date().getFullYear();
                const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
                if(res.ok) {
                    allHolidays = await res.json();
                    const holEvents = allHolidays.map(h => ({ start: h.date, display: 'background', color: '#ffcccc' }));
                    successCallback(holEvents);
                }
            } catch(e) {}

            // โหลดเวร
            const snap = await getDocs(collection(db, "shifts"));
            const shifts = snap.docs.map(d => ({
                id: d.id,
                title: d.data().name,
                start: d.data().date,
                backgroundColor: d.data().color,
                extendedProps: { shiftId: d.id }
            }));
            successCallback(shifts);
        },
        eventClick: async function(info) {
            if(info.event.display === 'background') return;
            if(confirm(`ลบเวร ${info.event.title} ออกจากปฏิทิน?`)) {
                await deleteDoc(doc(db, "shifts", info.event.extendedProps.shiftId));
                calendar.refetchEvents();
            }
        }
    });
    calendar.render();
}

// บันทึกเวรลงวันที่คลิก
document.getElementById('modalSaveBtn').addEventListener('click', async () => {
    const select = document.getElementById('modalShiftSelect');
    const opt = select.options[select.selectedIndex];
    if(!opt.value) return;

    await addDoc(collection(db, "shifts"), {
        date: currentSelectedDate,
        name: opt.dataset.name,
        color: opt.dataset.color,
        time: opt.dataset.time
    });
    bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
    calendar.refetchEvents();
});

// สรุปข้อมูลข้างปฏิทิน
async function updateSidebarSummary(startDate) {
    const m = startDate.getMonth();
    const y = startDate.getFullYear();
    const snap = await getDocs(collection(db, "shifts"));
    const summary = {};
    
    snap.forEach(d => {
        const data = d.data();
        const dDate = new Date(data.date);
        if(dDate.getMonth() === m && dDate.getFullYear() === y) {
            summary[data.name] = (summary[data.name] || 0) + 1;
        }
    });

    const sumBox = document.getElementById('summaryList');
    sumBox.innerHTML = "";
    Object.keys(summary).forEach(key => {
        sumBox.innerHTML += `<div class="d-flex justify-content-between mb-2"><span>${key}</span> <b>${summary[key]} ครั้ง</b></div>`;
    });

    // อัปเดตวันหยุด
    const holBox = document.getElementById('holidayList');
    holBox.innerHTML = "";
    allHolidays.forEach(h => {
        const hDate = new Date(h.date);
        if(hDate.getMonth() === m && hDate.getFullYear() === y) {
            holBox.innerHTML += `<li class="list-group-item small d-flex justify-content-between"><span>${hDate.getDate()} - ${h.localName}</span></li>`;
        }
    });
}
