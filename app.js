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
let customHolidaysData = []; 
let allShiftsData = []; 
let shiftTypesList = []; 

let currentSelectedDate = "";
let currentSelectedShiftType = null; 
let isFastAddMode = false;
let fastAddCurrentDate = null;

let currentFirstDay = parseInt(localStorage.getItem('calendarFirstDay') || '0');

document.addEventListener('DOMContentLoaded', async function() {
    await loadHolidays();
    initSystemSettings();
    initHolidaySettings();
    initSettingsView();
    initCalendarView();
    listenToDatabase(); 
});

async function loadHolidays() {
    try {
        const year = new Date().getFullYear();
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
        if(res.ok && res.status !== 204) {
            const text = await res.text();
            if(text && text.trim().length > 0) {
                allHolidays = JSON.parse(text);
                updateTodayStatus(); 
            }
        }
    } catch(e) { console.warn("ไม่สามารถโหลดวันหยุดได้", e); }
}

function listenToDatabase() {
    onSnapshot(collection(db, "shifts"), (snapshot) => {
        allShiftsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if(calendar) {
            calendar.refetchEvents();
            updateSidebarSummary(calendar.view.currentStart);
        }
        updateTodayStatus(); 
    });

    onSnapshot(collection(db, "customHolidays"), (snapshot) => {
        customHolidaysData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCustomHolidaysAdmin(); 
        if(calendar) {
            calendar.refetchEvents();
            updateSidebarSummary(calendar.view.currentStart);
        }
        updateTodayStatus();
    });
}

function updateTodayStatus() {
    const statusBox = document.getElementById('todayStatusHighlight');
    if (!statusBox) return;

    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let statusMessages = [];
    let isHoliday = false;

    const apiHoliday = allHolidays.find(h => h.date === localDate);
    if (apiHoliday) {
        statusMessages.push(`🇹🇭 ${apiHoliday.localName}`);
        isHoliday = true;
    }

    const customHoliday = customHolidaysData.find(h => h.date === localDate);
    if (customHoliday) {
        statusMessages.push(`🌴 ${customHoliday.name}`);
        isHoliday = true;
    }

    const todayShifts = allShiftsData.filter(s => s.date === localDate);
    
    // [UI อัปเกรด] เพิ่มพื้นหลังแบบ Gradient, จัด Layout ให้โปร่งขึ้น และเน้นไอคอนให้ชัดเจน
    if (todayShifts.length > 0) {
        let shiftBadges = todayShifts.map(s => `<span class="badge rounded-pill shadow-sm ms-2 px-3 py-2 border border-light" style="background-color: ${s.color}; font-size: 0.9rem; letter-spacing: 0.5px;">${s.name}</span>`).join('');
        
        statusBox.className = "alert alert-warning shadow-sm fw-bold mb-4 d-flex align-items-center rounded-4 border border-warning bg-gradient p-3";
        let prefix = isHoliday ? `<span class="text-muted small d-block mb-1">${statusMessages.join(' | ')}</span> วันนี้มีเวร ` : `วันนี้คุณมีเวร `;
        statusBox.innerHTML = `
            <div class="d-flex align-items-center w-100">
                <div class="bg-white p-3 rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                    <i class="fa-solid fa-user-doctor fs-4 text-warning"></i>
                </div> 
                <div class="flex-grow-1"><span class="text-dark fs-6">${prefix}</span> <div class="mt-2">${shiftBadges}</div></div>
            </div>`;
        
    } else if (isHoliday) {
        statusBox.className = "alert alert-success shadow-sm fw-bold mb-4 d-flex align-items-center rounded-4 border border-success bg-gradient p-3";
        statusBox.innerHTML = `
            <div class="d-flex align-items-center w-100">
                <div class="bg-white p-3 rounded-circle shadow-sm me-3 d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                    <i class="fa-solid fa-umbrella-beach fs-4 text-success"></i>
                </div> 
                <div>
                    <span class="text-dark fs-6">วันนี้เป็นวันหยุด: <span class="text-success">${statusMessages.join(' | ')}</span></span><br>
                    <span class="text-secondary small fw-normal mt-1 d-block">พักผ่อนได้เลย เติมพลังให้เต็มที่ ✨</span>
                </div>
            </div>`;
    } else {
        statusBox.className = "alert bg-light text-secondary shadow-sm fw-bold mb-4 d-flex align-items-center rounded-4 border p-3";
        statusBox.innerHTML = `
            <div class="d-flex align-items-center w-100">
                <div class="bg-white p-3 rounded-circle border shadow-sm me-3 d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                    <i class="fa-solid fa-mug-hot fs-4 text-secondary"></i>
                </div> 
                <div>
                    <span class="text-dark fs-6">วันนี้ไม่มีเวร</span><br>
                    <span class="text-muted small fw-normal mt-1 d-block">พักผ่อนได้เต็มที่ Have a good day! ☕</span>
                </div>
            </div>`;
    }
}

function initSystemSettings() {
    const dayButtons = document.querySelectorAll('.day-btn');
    
    dayButtons.forEach(btn => {
        if(parseInt(btn.dataset.day) === currentFirstDay) {
            btn.classList.add('active');
        }
        
        btn.addEventListener('click', (e) => {
            dayButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentFirstDay = parseInt(e.target.dataset.day);
            localStorage.setItem('calendarFirstDay', currentFirstDay);
            if(calendar) {
                calendar.setOption('firstDay', currentFirstDay);
            }
        });
    });
}

function initHolidaySettings() {
    const saveBtn = document.getElementById('saveHolidayBtn');
    const cancelBtn = document.getElementById('cancelEditHolidayBtn');
    
    saveBtn.addEventListener('click', async () => {
        const hDate = document.getElementById('holidayDate').value;
        const hName = document.getElementById('holidayName').value;
        const editId = document.getElementById('editHolidayId').value;
        
        if(!hDate || !hName) return alert("กรุณาระบุวันที่และชื่อวันหยุดให้ครบถ้วน");

        const data = { date: hDate, name: hName }; 

        if(editId) {
            await updateDoc(doc(db, "customHolidays", editId), data);
            alert("แก้ไขวันหยุดสำเร็จ");
        } else {
            await addDoc(collection(db, "customHolidays"), data);
            alert("เพิ่มวันหยุดสำเร็จ");
        }
        resetHolidayForm();
    });

    cancelBtn.addEventListener('click', resetHolidayForm);
}

function resetHolidayForm() {
    document.getElementById('holidayDate').value = "";
    document.getElementById('holidayName').value = "";
    document.getElementById('editHolidayId').value = "";
    document.getElementById('saveHolidayBtn').innerHTML = "<i class='fa-solid fa-save me-1'></i> บันทึกวันหยุด";
    document.getElementById('cancelEditHolidayBtn').classList.add('d-none');
    document.getElementById('holidayFormTitle').innerText = "เพิ่มวันหยุดใหม่";
}

function renderCustomHolidaysAdmin() {
    const list = document.getElementById('customHolidayList');
    list.innerHTML = "";
    
    const sorted = [...customHolidaysData].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(h => {
        const hDate = new Date(h.date);
        const day = hDate.getDate();
        const month = hDate.toLocaleDateString('th-TH', { month:'short' });
        
        const item = document.createElement('div');
        // [UI อัปเกรด] เปลี่ยนจาก p-3 เป็น p-4 เพื่อเพิ่มระยะห่างจากขอบ (Padding) ให้ดูโปร่งขึ้น
        item.className = "list-group-item d-flex justify-content-between align-items-center mb-3 shadow-sm rounded-4 bg-white border border-light p-4 hover-effect";
        item.style.transition = "all 0.2s ease-in-out";
        item.innerHTML = `
            <div class="d-flex align-items-center gap-4"> <div class="bg-danger bg-opacity-10 text-danger rounded-4 p-2 text-center d-flex flex-column justify-content-center border border-danger border-opacity-25" style="min-width: 60px; height: 60px;">
                    <div class="fw-bold fs-4 lh-1">${day}</div>
                    <div class="small fw-semibold mt-1" style="font-size: 0.75rem;">${month}</div>
                </div>
                <div>
                    <div class="fw-bold text-dark fs-6 mb-1">🌴 ${h.name}</div>
                    <div class="text-muted small d-flex align-items-center gap-1"><i class="fa-regular fa-calendar-days"></i> ปี ${hDate.getFullYear() + 543}</div>
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-2 shadow-sm" onclick="editCustomHoliday('${h.id}', '${h.date}', '${h.name}')" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-2 shadow-sm" onclick="deleteCustomHoliday('${h.id}')" title="ลบ"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

window.editCustomHoliday = (id, date, name) => {
    document.getElementById('editHolidayId').value = id;
    document.getElementById('holidayDate').value = date;
    document.getElementById('holidayName').value = name;
    document.getElementById('saveHolidayBtn').innerHTML = "<i class='fa-solid fa-check me-1'></i> อัปเดตวันหยุด";
    document.getElementById('cancelEditHolidayBtn').classList.remove('d-none');
    document.getElementById('holidayFormTitle').innerText = "แก้ไขวันหยุด";
};

window.deleteCustomHoliday = async (id) => {
    if(confirm("ยืนยันการลบวันหยุดนี้ออกจากระบบ?")) {
        await deleteDoc(doc(db, "customHolidays", id));
    }
};

window.openFastAddModal = () => {
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('fastAddStartDate').value = localDate;
    new bootstrap.Modal(document.getElementById('fastAddDateModal')).show();
};

window.startFastAdd = () => {
    const dateVal = document.getElementById('fastAddStartDate').value;
    if(!dateVal) return alert('กรุณาเลือกวันเริ่มต้นลงเวร');
    
    const parts = dateVal.split('-');
    fastAddCurrentDate = new Date(parts[0], parts[1] - 1, parts[2]);

    bootstrap.Modal.getInstance(document.getElementById('fastAddDateModal')).hide();
    isFastAddMode = true;
    document.getElementById('fastAddBar').classList.remove('d-none');
    updateFastAddLabel();
    switchView('calendar');
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

async function handleFastAdd(typeData) {
    const localDate = new Date(fastAddCurrentDate.getTime() - (fastAddCurrentDate.getTimezoneOffset() * 60000));
    const dateStr = localDate.toISOString().split('T')[0];
    
    await addDoc(collection(db, "shifts"), {
        date: dateStr, name: typeData.name, color: typeData.color,
        time: typeData.hasTime ? `${typeData.start}-${typeData.end}` : "", note: ""
    });

    fastAddCurrentDate.setDate(fastAddCurrentDate.getDate() + 1);
    updateFastAddLabel();
}

function initSettingsView() {
    const saveTypeBtn = document.getElementById('saveTypeBtn');
    
    saveTypeBtn.addEventListener('click', async () => {
        const toggleTime = document.getElementById('toggleTime');
        const typeName = document.getElementById('typeName');
        const typeColor = document.getElementById('typeColor');
        
        const data = {
            name: typeName.value, color: typeColor.value, hasTime: toggleTime.checked,
            start: toggleTime.checked ? document.getElementById('startTime').value : "",
            end: toggleTime.checked ? document.getElementById('endTime').value : ""
        };
        if(!data.name) return alert("โปรดระบุชื่อเวร");
        
        await addDoc(collection(db, "shiftTypes"), data);
        typeName.value = "";
        alert("เพิ่มประเภทเวรสำเร็จ");
    });

    onSnapshot(collection(db, "shiftTypes"), (snapshot) => {
        const list = document.getElementById('shiftTypeList');
        const modalButtons = document.getElementById('modalShiftButtons'); 
        const fastAddButtons = document.getElementById('fastAddButtons'); 
        
        list.innerHTML = "";
        if(modalButtons) modalButtons.innerHTML = "";
        if(fastAddButtons) fastAddButtons.innerHTML = "";
        shiftTypesList = []; 
        
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const id = docSnap.id;
            shiftTypesList.push({ id, ...t });
            
            // [UI อัปเกรด] ปรับปรุงรายการประเภทเวร
            const item = document.createElement('div');
            item.className = "list-group-item d-flex justify-content-between align-items-center mb-3 shadow-sm rounded-4 bg-white border border-light p-3";
            item.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${t.color}; box-shadow: 0 4px 8px ${t.color}60; border: 2px solid white;"></div>
                    <span class="fw-bold fs-6 text-dark">${t.name}</span> 
                    ${t.hasTime ? `<span class="badge bg-light text-secondary border rounded-pill px-3 py-2 fw-medium ms-2"><i class="fa-regular fa-clock me-1"></i>${t.start} - ${t.end}</span>` : ""}
                </div>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3 shadow-sm" onclick="deleteType('${id}')" title="ลบประเภทเวร"><i class="fa-solid fa-trash-can"></i></button>
            `;
            list.appendChild(item);

            if(fastAddButtons) {
                const btnFast = document.createElement('button');
                btnFast.className = "btn text-white fw-bold text-nowrap rounded-pill px-4 py-2 shadow-sm border border-light";
                btnFast.style.backgroundColor = t.color;
                btnFast.innerText = t.name;
                btnFast.onclick = () => handleFastAdd(t);
                fastAddButtons.appendChild(btnFast);
            }

            if(modalButtons) {
                const btnModal = document.createElement('button');
                btnModal.className = "btn text-white fw-bold shift-btn rounded-pill px-4 py-2 shadow-sm border border-light m-1";
                btnModal.style.backgroundColor = t.color;
                btnModal.style.opacity = "0.5"; // ปรับ Opacity ให้ซอฟต์ลงตอนยังไม่กด
                btnModal.innerText = t.name;
                
                btnModal.onclick = () => {
                    document.querySelectorAll('.shift-btn').forEach(b => b.style.opacity = "0.5");
                    btnModal.style.opacity = "1";
                    // เพิ่มคลาสเน้นกรอบตอนที่ถูกเลือก
                    document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('border-dark', 'border-2'));
                    btnModal.classList.add('border-dark', 'border-2');
                    currentSelectedShiftType = { id, ...t }; 
                };
                modalButtons.appendChild(btnModal);
            }
        });
        if(calendar) updateSidebarSummary(calendar.view.currentStart);
    });
}

window.deleteType = async (id) => {
    if(confirm("คุณยืนยันที่จะลบประเภทเวรนี้ใช่หรือไม่?")) await deleteDoc(doc(db, "shiftTypes", id));
};

function initCalendarView() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        firstDay: currentFirstDay,
        headerToolbar: { 
            left: 'prev,next today', 
            center: 'title', 
            right: 'dayGridMonth,listMonth' 
        },
        height: 'auto', // ช่วยให้ปฏิทินแสดงผลได้เต็มที่ไม่โดนตัด
        dayMaxEvents: true, // แสดงปุ่ม +more ถ้ารายการเยอะเกิน
        dateClick: function(info) {
            currentSelectedDate = info.dateStr;
            document.getElementById('modalDateLabel').innerText = info.dateStr;
            document.querySelectorAll('.shift-btn').forEach(b => {
                b.style.opacity = "0.5";
                b.classList.remove('border-dark', 'border-2');
            });
            currentSelectedShiftType = null; 
            document.getElementById('modalNote').value = "";
            new bootstrap.Modal(document.getElementById('addEventModal')).show();
        },
        datesSet: (info) => updateSidebarSummary(info.view.currentStart),
        events: function(info, successCallback) {
            const apiEvents = allHolidays.map(h => ({ 
                start: h.date, title: `🇹🇭 ${h.localName}`, allDay: true, 
                display: 'block', backgroundColor: '#fff0f0', borderColor: '#ffcccc', textColor: '#d93025',
                className: 'holiday-event rounded-2 px-1 mb-1 shadow-sm border', extendedProps: { isHoliday: true }
            }));
            
            const customEvents = customHolidaysData.map(h => ({ 
                start: h.date, title: `🌴 ${h.name}`, allDay: true, 
                display: 'block', backgroundColor: '#f0f8ff', borderColor: '#b3e0ff', textColor: '#0066cc',
                className: 'holiday-event rounded-2 px-1 mb-1 shadow-sm border', extendedProps: { isHoliday: true }
            }));

            const shiftEvents = allShiftsData.map(d => ({
                id: d.id, title: d.name, start: d.date, 
                backgroundColor: d.color, borderColor: 'transparent', // เอาเส้นขอบออกให้สีเนียนขึ้น
                className: 'rounded-2 px-2 py-1 mb-1 shadow-sm text-white fw-bold', // เพิ่มเงาและปรับฟอนต์เวร
                extendedProps: { shiftId: d.id, note: d.note || "", isHoliday: false }
            }));
            
            successCallback([...apiEvents, ...customEvents, ...shiftEvents]);
        },
        eventClick: async function(info) {
            if(info.event.extendedProps.isHoliday) return; 
            
            const noteText = info.event.extendedProps.note ? `\n\n📝 โน้ต: ${info.event.extendedProps.note}` : "";
            if(confirm(`เวร: ${info.event.title}${noteText}\n\nต้องการลบเวรนี้ออกจากปฏิทินใช่หรือไม่?`)) {
                await deleteDoc(doc(db, "shifts", info.event.extendedProps.shiftId));
            }
        }
    });
    calendar.render();
    
    window.calendarInstance = calendar;
}

document.getElementById('modalSaveBtn').addEventListener('click', async () => {
    if(!currentSelectedShiftType) return alert("กรุณาเลือกประเภทเวรก่อนทำการบันทึก");
    const noteInput = document.getElementById('modalNote').value;
    
    await addDoc(collection(db, "shifts"), {
        date: currentSelectedDate, name: currentSelectedShiftType.name,
        color: currentSelectedShiftType.color,
        time: currentSelectedShiftType.hasTime ? `${currentSelectedShiftType.start}-${currentSelectedShiftType.end}` : "",
        note: noteInput
    });
    bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
});

// ฟังก์ชันตกแต่งสีสันสรุปยอดเวร
function updateSidebarSummary(startDate) {
    if(!startDate) return;
    const m = startDate.getMonth();
    const y = startDate.getFullYear();
    const summary = {};
    
    shiftTypesList.forEach(type => { 
        summary[type.name] = { count: 0, color: type.color }; 
    });
    
    allShiftsData.forEach(data => {
        const dDate = new Date(data.date);
        if(dDate.getMonth() === m && dDate.getFullYear() === y) {
            if(summary[data.name]) {
                summary[data.name].count++;
            } else {
                summary[data.name] = { count: 1, color: data.color || '#6c757d' };
            }
        }
    });

    const sumBox = document.getElementById('summaryList');
    if(sumBox) {
        sumBox.innerHTML = "";
        Object.keys(summary).forEach(key => {
            const s = summary[key];
            if (s.count > 0) { 
                // [UI อัปเกรด] ปรับการ์ดสรุปยอดเวรให้ดูน่าอ่าน คล้าย Dashboard Cards
                sumBox.innerHTML += `
                    <div class="d-flex justify-content-between align-items-center mb-3 p-3 rounded-4 shadow-sm bg-white" style="border-left: 6px solid ${s.color};">
                        <div class="d-flex align-items-center gap-3">
                            <div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${s.color}; box-shadow: 0 0 6px ${s.color}80;"></div>
                            <span class="fw-bold text-dark fs-6">${key}</span> 
                        </div>
                        <span class="badge rounded-pill text-white shadow-sm px-3 py-2 fs-6" style="background-color: ${s.color};">${s.count} เวร</span>
                    </div>`;
            }
        });
        if (sumBox.innerHTML === "") {
            sumBox.innerHTML = `
                <div class="text-muted text-center small my-4 py-4 bg-light rounded-4 border border-dashed shadow-sm">
                    <i class="fa-solid fa-calendar-xmark mb-3 fs-3 text-secondary opacity-50"></i><br>
                    <span class="fw-medium">เดือนนี้ยังไม่มีเวร</span>
                </div>`;
        }
    }

    const holBox = document.getElementById('holidayList');
    if(holBox) {
        holBox.innerHTML = "";
        allHolidays.forEach(h => {
            const hDate = new Date(h.date);
            if(hDate.getMonth() === m && hDate.getFullYear() === y) {
                holBox.innerHTML += `
                <div class="d-flex align-items-center py-2 px-3 mb-2 rounded-3 bg-danger bg-opacity-10 border border-danger border-opacity-25">
                    <span class="text-danger small fw-medium"><i class="fa-regular fa-flag me-2"></i>${hDate.getDate()} - ${h.localName}</span>
                </div>`;
            }
        });
        customHolidaysData.forEach(h => {
            const hDate = new Date(h.date);
            if(hDate.getMonth() === m && hDate.getFullYear() === y) {
                holBox.innerHTML += `
                <div class="d-flex align-items-center py-2 px-3 mb-2 rounded-3 bg-primary bg-opacity-10 border border-primary border-opacity-25">
                    <span class="text-primary small fw-medium"><i class="fa-solid fa-umbrella-beach me-2"></i>${hDate.getDate()} - ${h.name}</span>
                </div>`;
            }
        });
        if (holBox.innerHTML === "") {
            holBox.innerHTML = `<div class="text-muted text-center small my-3 py-2 bg-light rounded-3 border">ไม่มีวันหยุดในเดือนนี้</div>`;
        }
    }
}

// ==========================================
// ส่วนของการส่งออก (Export Features)
// ==========================================

window.exportToImage = async () => {
    const targetElement = document.getElementById('calendarCaptureArea');
    const originalShadow = targetElement.style.boxShadow;
    
    targetElement.style.boxShadow = 'none';
    
    try {
        const canvas = await html2canvas(targetElement, { scale: 2 });
        const link = document.createElement('a');
        link.download = `ตารางเวรรังสี_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการบันทึกรูปภาพ: " + err);
    }
    
    targetElement.style.boxShadow = originalShadow;
};

window.exportToICal = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Radiology Shift Pro//TH\n";
    
    allShiftsData.forEach(shift => {
        const dateObj = new Date(shift.date);
        const dtStart = dateObj.toISOString().split('T')[0].replace(/-/g, '');
        
        dateObj.setDate(dateObj.getDate() + 1);
        const dtEnd = dateObj.toISOString().split('T')[0].replace(/-/g, '');
        
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `DTSTART;VALUE=DATE:${dtStart}\n`;
        icsContent += `DTEND;VALUE=DATE:${dtEnd}\n`;
        icsContent += `SUMMARY:เวร ${shift.name}\n`;
        if(shift.time || shift.note) {
            let desc = "";
            if(shift.time) desc += `เวลา: ${shift.time} `;
            if(shift.note) desc += `(โน้ต: ${shift.note})`;
            icsContent += `DESCRIPTION:${desc.trim()}\n`;
        }
        icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'radiology_shifts.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
