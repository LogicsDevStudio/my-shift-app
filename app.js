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

// ตัวแปรสำหรับระบบลงเวรด่วนและสรุปผล
let isFastAddMode = false;
let fastAddCurrentDate = null;
let shiftTypesList = []; 

document.addEventListener('DOMContentLoaded', function() {
    initSettingsView();
    initCalendarView();
});

// --- เพิ่มฟังก์ชันจัดการ Fast Add (ลงเวรด่วน) ---
window.toggleFastAdd = (show) => {
    isFastAddMode = show;
    const bar = document.getElementById('fastAddBar');
    if(show) {
        bar.classList.remove('d-none');
        // เริ่มต้นที่วันที่ปัจจุบัน
        fastAddCurrentDate = new Date();
        updateFastAddLabel();
    } else {
        bar.classList.add('d-none');
    }
};

function updateFastAddLabel() {
    const label = document.getElementById('fastAddDateLabel');
    if(label) {
        label.innerText = fastAddCurrentDate.toLocaleDateString('th-TH', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
    }
}

// ฟังก์ชันบันทึกเวรด่วนและเลื่อนวัน
async function handleFastAdd(typeData) {
    // ปรับ timezone ชดเชยเวลาเพื่อให้ได้วันที่ตรงตามปฏิทิน
    const localDate = new Date(fastAddCurrentDate.getTime() - (fastAddCurrentDate.getTimezoneOffset() * 60000));
    const dateStr = localDate.toISOString().split('T')[0];
    
    await addDoc(collection(db, "shifts"), {
        date: dateStr,
        name: typeData.name,
        color: typeData.color,
        time: typeData.hasTime ? `${typeData.start}-${typeData.end}` : "",
        note: "" // ลงด่วนจะไม่มีโน้ต
    });

    // เลื่อนไปวันถัดไป
    fastAddCurrentDate.setDate(fastAddCurrentDate.getDate() + 1);
    updateFastAddLabel();
    calendar.refetchEvents();
}


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
        const fastAddButtons = document.getElementById('fastAddButtons'); // สำหรับปุ่มเวรด่วน
        
        list.innerHTML = "";
        modalSelect.innerHTML = "<option value=''>-- เลือกเวร --</option>";
        if(fastAddButtons) fastAddButtons.innerHTML = "";
        shiftTypesList = []; // ล้างค่าเก่า
        
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const id = docSnap.id;
            
            // เก็บรายการเวรไว้ใช้สำหรับสรุปผล
            shiftTypesList.push({ id, ...t });
            
            // 1. ใส่ในหน้าตั้งค่า
            const item = document.createElement('div');
            item.className = "list-group-item d-flex justify-content-between align-items-center border-0 mb-2 shadow-sm rounded-3";
            item.innerHTML = `<div><span class="badge" style="background:${t.color}">&nbsp;</span> <b>${t.name}</b> ${t.hasTime ? `<small>(${t.start}-${t.end})</small>` : ""}</div>
                              <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteType('${id}')">ลบ</button>`;
            list.appendChild(item);

            // 2. ใส่ใน Modal เลือกเวร
            const opt = document.createElement('option');
            opt.value = id;
            opt.dataset.name = t.name;
            opt.dataset.color = t.color;
            opt.dataset.time = t.hasTime ? `${t.start}-${t.end}` : "";
            opt.innerText = t.name;
            modalSelect.appendChild(opt);

            // 3. สร้างปุ่มสำหรับ Fast Add
            if(fastAddButtons) {
                const btn = document.createElement('button');
                btn.className = "btn text-white fw-bold text-nowrap";
                btn.style.backgroundColor = t.color;
                btn.innerText = t.name;
                btn.onclick = () => handleFastAdd(t);
                fastAddButtons.appendChild(btn);
            }
        });
    });
}

// ฟังก์ชันลบประเภทเวร
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
            // โหลดวันหยุด (เพิ่มการตรวจสอบข้อมูลว่างเพื่อป้องกัน Error)
            try {
                const year = new Date().getFullYear();
                const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
                if(res.ok && res.status !== 204) {
                    const text = await res.text();
                    if(text && text.trim().length > 0) {
                        allHolidays = JSON.parse(text);
                        const holEvents = allHolidays.map(h => ({ start: h.date, display: 'background', color: '#ffcccc' }));
                        successCallback(holEvents);
                    }
                }
            } catch(e) { console.warn("ไม่สามารถโหลดวันหยุดได้", e); }

            // โหลดเวร
            const snap = await getDocs(collection(db, "shifts"));
            const shifts = snap.docs.map(d => ({
                id: d.id,
                title: d.data().name,
                start: d.data().date,
                backgroundColor: d.data().color,
                extendedProps: { 
                    shiftId: d.id,
                    note: d.data().note || "" // ดึงโน้ตมาเก็บไว้
                }
            }));
            successCallback(shifts);
        },
        eventClick: async function(info) {
            if(info.event.display === 'background') return;
            
            // แสดงโน้ตให้เห็นตอนกดยืนยันการลบ
            const noteText = info.event.extendedProps.note ? `\nโน้ต: ${info.event.extendedProps.note}` : "";
            
            if(confirm(`เวร: ${info.event.title}${noteText}\n\nต้องการลบเวรนี้ออกจากปฏิทินใช่หรือไม่?`)) {
                await deleteDoc(doc(db, "shifts", info.event.extendedProps.shiftId));
                calendar.refetchEvents();
            }
        }
    });
    calendar.render();
}

// บันทึกเวรลงวันที่คลิก (เพิ่มการบันทึกโน้ต)
document.getElementById('modalSaveBtn').addEventListener('click', async () => {
    const select = document.getElementById('modalShiftSelect');
    const noteInput = document.getElementById('modalNote'); // ช่องรับโน้ต
    
    const opt = select.options[select.selectedIndex];
    if(!opt.value) return;

    await addDoc(collection(db, "shifts"), {
        date: currentSelectedDate,
        name: opt.dataset.name,
        color: opt.dataset.color,
        time: opt.dataset.time || "",
        note: noteInput ? noteInput.value : "" // บันทึกโน้ตลงฐานข้อมูล
    });
    
    // ล้างข้อมูลและปิด Modal
    if(noteInput) noteInput.value = "";
    select.value = "";
    
    bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
    calendar.refetchEvents();
});

// สรุปข้อมูลข้างปฏิทิน (อัปเดตให้อิงจากรายการเวรในตั้งค่า)
async function updateSidebarSummary(startDate) {
    const m = startDate.getMonth();
    const y = startDate.getFullYear();
    const snap = await getDocs(collection(db, "shifts"));
    
    // กำหนดค่าเริ่มต้นเวรทุกประเภทให้เป็น 0 ก่อน
    const summary = {};
    shiftTypesList.forEach(type => {
        summary[type.name] = 0;
    });
    
    snap.forEach(d => {
        const data = d.data();
        const dDate = new Date(data.date);
        if(dDate.getMonth() === m && dDate.getFullYear() === y) {
            if(summary.hasOwnProperty(data.name)) {
                summary[data.name]++;
            } else {
                summary[data.name] = 1; // เผื่อเวรที่ถูกลบออกจากตั้งค่าไปแล้วแต่ยังอยู่ในปฏิทิน
            }
        }
    });

    const sumBox = document.getElementById('summaryList');
    sumBox.innerHTML = "";
    Object.keys(summary).forEach(key => {
        sumBox.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom border-light">
                <span class="small">${key}</span> 
                <span class="badge bg-light text-dark rounded-pill">${summary[key]} ครั้ง</span>
            </div>`;
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
