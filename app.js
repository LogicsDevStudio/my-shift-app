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

document.addEventListener('DOMContentLoaded', async function () {
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
        if (res.ok && res.status !== 204) {
            const text = await res.text();
            if (text && text.trim().length > 0) {
                allHolidays = JSON.parse(text);
                updateTodayStatus();
            }
        }
    } catch (e) { console.warn("ไม่สามารถโหลดวันหยุดได้", e); }
}

function listenToDatabase() {
    onSnapshot(collection(db, "shifts"), (snapshot) => {
        allShiftsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (calendar) {
            calendar.refetchEvents();
            updateSidebarSummary(calendar.view.currentStart);
        }
        updateTodayStatus();
    });

    onSnapshot(collection(db, "customHolidays"), (snapshot) => {
        customHolidaysData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCustomHolidaysAdmin();
        if (calendar) {
            calendar.refetchEvents();
            updateSidebarSummary(calendar.view.currentStart);
        }
        updateTodayStatus();
    });
}

// ─── Today Status ─────────────────────────────────────────────────────────────
function updateTodayStatus() {
    const statusBox = document.getElementById('todayStatusHighlight');
    if (!statusBox) return;

    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let statusMessages = [];
    let isHoliday = false;

    const apiHoliday = allHolidays.find(h => h.date === localDate);
    if (apiHoliday) { statusMessages.push(`🇹🇭 ${apiHoliday.localName}`); isHoliday = true; }

    const customHoliday = customHolidaysData.find(h => h.date === localDate);
    if (customHoliday) { statusMessages.push(`🌴 ${customHoliday.name}`); isHoliday = true; }

    const todayShifts = allShiftsData.filter(s => s.date === localDate);

    if (todayShifts.length > 0) {
        // กรณี: มีเวร -> ใช้สีของเวรแรกเป็นธีมหลัก (สมมติว่า s.color เป็น Hex เช่น #ff5500)
        const mainColor = todayShifts[0].color || '#f59e0b'; 

        const shiftBadges = todayShifts.map(s => `
            <span class="badge rounded-pill px-3 py-2 fw-bold ms-1" 
                  style="background:${s.color}; color:#fff; font-size:0.82rem; box-shadow:0 4px 12px ${s.color}55; letter-spacing:0.3px;">
                ${s.name}
            </span>`).join('');

        const holidayNote = isHoliday
            ? `<span class="d-block small fw-normal mt-1" style="color:rgba(0,0,0,0.6);">${statusMessages.join(' | ')}</span>`
            : '';

        statusBox.className = "alert fw-bold mb-4 d-flex align-items-center rounded-pill";
        
        // เติม Alpha (เช่น 15, 08, 40) ท้ายรหัสสี Hex เพื่อกำหนดความโปร่งใสโดยอัตโนมัติ
        statusBox.style.cssText = `
            background: linear-gradient(135deg, ${mainColor}15 0%, ${mainColor}08 100%);
            border: 1.5px solid ${mainColor}40;
            box-shadow: 0 4px 20px ${mainColor}15;
            padding: 14px 24px;
        `;
        statusBox.innerHTML = `
            <div class="d-flex align-items-center gap-3 w-100 flex-wrap">
                <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                     style="width:44px;height:44px;background:${mainColor};box-shadow:0 6px 16px ${mainColor}60;">
                    <i class="fa-solid fa-user-doctor text-white" style="font-size:1.1rem;"></i>
                </div>
                <div>
                    <span style="color:#333;font-size:0.92rem;font-weight:700;">วันนี้คุณมีเวร</span>
                    ${holidayNote}
                    <div class="mt-1 d-flex flex-wrap gap-1">${shiftBadges}</div>
                </div>
            </div>`;

    } else if (isHoliday) {
        // กรณี: วันลา หรือ วันหยุดราชการ -> ใช้สีโทนพักผ่อน (เขียวมิ้นต์/ฟ้าทะเล)
        statusBox.className = "alert fw-bold mb-4 d-flex align-items-center rounded-pill";
        statusBox.style.cssText = `
            background: linear-gradient(135deg, #e6fcf5 0%, #c1f6e6 100%);
            border: 1.5px solid rgba(18, 184, 134, 0.3);
            box-shadow: 0 4px 20px rgba(18, 184, 134, 0.15);
            padding: 14px 24px;
        `;
        statusBox.innerHTML = `
            <div class="d-flex align-items-center gap-3 w-100">
                <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                     style="width:44px;height:44px;background:linear-gradient(135deg,#20c997,#12b886);box-shadow:0 6px 16px rgba(32, 201, 151, 0.4);">
                    <i class="fa-solid fa-umbrella-beach text-white" style="font-size:1.1rem;"></i>
                </div>
                <div>
                    <span style="color:#087f5b;font-size:0.92rem;">วันนี้เป็นวันหยุด / วันลา</span>
                    <span class="fw-bold ms-1" style="color:#099268;">${statusMessages.join(' | ')}</span>
                    <span class="d-block small fw-normal mt-1" style="color:rgba(8, 127, 91, 0.7);">พักผ่อนให้เต็มที่ เติมพลังให้ตัวเอง ✨</span>
                </div>
            </div>`;

    } else {
        // กรณี: ไม่มีเวร (วันธรรมดาทั่วไป) -> ใช้โทนสีฟ้าอ่อนสบายตา
        statusBox.className = "alert fw-bold mb-4 d-flex align-items-center rounded-pill";
        statusBox.style.cssText = `
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 1.5px solid rgba(14, 165, 233, 0.25);
            box-shadow: 0 4px 20px rgba(14, 165, 233, 0.1);
            padding: 14px 24px;
        `;
        statusBox.innerHTML = `
            <div class="d-flex align-items-center gap-3 w-100">
                <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                     style="width:44px;height:44px;background:linear-gradient(135deg,#38bdf8,#0ea5e9);box-shadow:0 6px 16px rgba(14, 165, 233, 0.35);">
                    <i class="fa-solid fa-house-chimney-window text-white" style="font-size:1.1rem;"></i>
                </div>
                <div>
                    <span style="color:#0369a1;font-size:0.92rem;">วันนี้ไม่มีเวร</span>
                    <span class="d-block small fw-normal mt-1" style="color:rgba(3, 105, 161, 0.7);">เวลาส่วนตัว Have a good day! ☕</span>
                </div>
            </div>`;
    }
}

// ─── System Settings ──────────────────────────────────────────────────────────
function initSystemSettings() {
    const dayButtons = document.querySelectorAll('.day-btn');
    dayButtons.forEach(btn => {
        if (parseInt(btn.dataset.day) === currentFirstDay) btn.classList.add('active');
        btn.addEventListener('click', (e) => {
            dayButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFirstDay = parseInt(e.target.dataset.day);
            localStorage.setItem('calendarFirstDay', currentFirstDay);
            if (calendar) calendar.setOption('firstDay', currentFirstDay);
        });
    });
}

// ─── Holiday Settings ─────────────────────────────────────────────────────────
function initHolidaySettings() {
    document.getElementById('saveHolidayBtn').addEventListener('click', async () => {
        const hDate = document.getElementById('holidayDate').value;
        const hName = document.getElementById('holidayName').value;
        const editId = document.getElementById('editHolidayId').value;
        if (!hDate || !hName) return alert("กรุณาระบุวันที่และชื่อวันหยุดให้ครบถ้วน");
        const data = { date: hDate, name: hName };
        if (editId) {
            await updateDoc(doc(db, "customHolidays", editId), data);
            alert("แก้ไขวันหยุดสำเร็จ");
        } else {
            await addDoc(collection(db, "customHolidays"), data);
            alert("เพิ่มวันหยุดสำเร็จ");
        }
        resetHolidayForm();
    });
    document.getElementById('cancelEditHolidayBtn').addEventListener('click', resetHolidayForm);
}

function resetHolidayForm() {
    document.getElementById('holidayDate').value = "";
    document.getElementById('holidayName').value = "";
    document.getElementById('editHolidayId').value = "";
    document.getElementById('saveHolidayBtn').innerHTML = `<i class="fa-solid fa-floppy-disk me-2"></i>บันทึกวันหยุด`;
    document.getElementById('cancelEditHolidayBtn').classList.add('d-none');
    document.getElementById('holidayFormTitle').innerHTML = `<i class="fa-solid fa-calendar-plus me-2"></i>เพิ่มวันหยุดใหม่`;
}

// ─── Render Custom Holidays Admin List ────────────────────────────────────────
function renderCustomHolidaysAdmin() {
    const list = document.getElementById('customHolidayList');
    list.innerHTML = "";

    const sorted = [...customHolidaysData].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length === 0) {
        list.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fa-solid fa-calendar-xmark fs-2 mb-3 d-block" style="color:rgba(99,102,241,0.25);"></i>
                <span class="small fw-medium">ยังไม่มีวันหยุดที่กำหนดเอง</span>
            </div>`;
        return;
    }

    sorted.forEach(h => {
        const hDate = new Date(h.date);
        const day = hDate.getDate();
        const month = hDate.toLocaleDateString('th-TH', { month: 'short' });
        const yearTH = hDate.getFullYear() + 543;

        const item = document.createElement('div');
        item.className = "list-group-item d-flex justify-content-between align-items-center";
        item.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="rounded-3 text-center d-flex flex-column align-items-center justify-content-center flex-shrink-0"
                     style="width:52px;height:52px;background:linear-gradient(135deg,rgba(244,63,94,0.1),rgba(244,63,94,0.06));border:1.5px solid rgba(244,63,94,0.2);">
                    <div class="fw-bold lh-1" style="font-size:1.2rem;color:#e11d48;">${day}</div>
                    <div class="fw-semibold mt-1" style="font-size:0.68rem;color:#f43f5e;text-transform:uppercase;letter-spacing:0.3px;">${month}</div>
                </div>
                <div>
                    <div class="fw-bold mb-1" style="font-size:0.95rem;color:#1e1b4b;">🌴 ${h.name}</div>
                    <div class="small d-flex align-items-center gap-1" style="color:#94a3b8;">
                        <i class="fa-regular fa-calendar-days" style="font-size:0.75rem;"></i> พ.ศ. ${yearTH}
                    </div>
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-light" style="border-radius:10px;border:1.5px solid #e2e8f0;width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;"
                    onclick="editCustomHoliday('${h.id}', '${h.date}', '${h.name}')" title="แก้ไข">
                    <i class="fa-solid fa-pen" style="font-size:0.8rem;color:#64748b;"></i>
                </button>
                <button class="btn btn-sm" style="border-radius:10px;border:1.5px solid rgba(244,63,94,0.25);background:rgba(244,63,94,0.06);width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;"
                    onclick="deleteCustomHoliday('${h.id}')" title="ลบ">
                    <i class="fa-solid fa-trash-can" style="font-size:0.8rem;color:#f43f5e;"></i>
                </button>
            </div>`;
        list.appendChild(item);
    });
}

window.editCustomHoliday = (id, date, name) => {
    document.getElementById('editHolidayId').value = id;
    document.getElementById('holidayDate').value = date;
    document.getElementById('holidayName').value = name;
    document.getElementById('saveHolidayBtn').innerHTML = `<i class="fa-solid fa-check me-2"></i>อัปเดตวันหยุด`;
    document.getElementById('cancelEditHolidayBtn').classList.remove('d-none');
    document.getElementById('holidayFormTitle').innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>แก้ไขวันหยุด`;
};

window.deleteCustomHoliday = async (id) => {
    if (confirm("ยืนยันการลบวันหยุดนี้ออกจากระบบ?")) {
        await deleteDoc(doc(db, "customHolidays", id));
    }
};

// ─── Fast Add ─────────────────────────────────────────────────────────────────
window.openFastAddModal = () => {
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('fastAddStartDate').value = localDate;
    new bootstrap.Modal(document.getElementById('fastAddDateModal')).show();
};

window.startFastAdd = () => {
    const dateVal = document.getElementById('fastAddStartDate').value;
    if (!dateVal) return alert('กรุณาเลือกวันเริ่มต้นลงเวร');
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
    if (!show) document.getElementById('fastAddBar').classList.add('d-none');
};

function updateFastAddLabel() {
    const label = document.getElementById('fastAddDateLabel');
    if (label) {
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

// ─── Settings View (Shift Types) ─────────────────────────────────────────────
function initSettingsView() {
    // Live preview
    const typeNameInput = document.getElementById('typeName');
    const typeColorInput = document.getElementById('typeColor');
    const previewEl = document.getElementById('previewEvent');
    const toggleTime = document.getElementById('toggleTime');
    const timeSection = document.getElementById('timeInputSection');

    typeNameInput.addEventListener('input', () => {
        previewEl.innerText = typeNameInput.value || 'ชื่อเวร';
    });
    typeColorInput.addEventListener('input', () => {
        previewEl.style.background = typeColorInput.value;
        previewEl.style.boxShadow = `0 4px 14px ${typeColorInput.value}55`;
    });
    toggleTime.addEventListener('change', () => {
        timeSection.style.display = toggleTime.checked ? 'block' : 'none';
    });

    document.getElementById('saveTypeBtn').addEventListener('click', async () => {
        const data = {
            name: typeNameInput.value, color: typeColorInput.value, hasTime: toggleTime.checked,
            start: toggleTime.checked ? document.getElementById('startTime').value : "",
            end: toggleTime.checked ? document.getElementById('endTime').value : ""
        };
        if (!data.name) return alert("โปรดระบุชื่อเวร");
        await addDoc(collection(db, "shiftTypes"), data);
        typeNameInput.value = "";
        previewEl.innerText = 'ชื่อเวร';
        alert("เพิ่มประเภทเวรสำเร็จ");
    });

    onSnapshot(collection(db, "shiftTypes"), (snapshot) => {
        const list = document.getElementById('shiftTypeList');
        const modalButtons = document.getElementById('modalShiftButtons');
        const fastAddButtons = document.getElementById('fastAddButtons');

        list.innerHTML = "";
        if (modalButtons) modalButtons.innerHTML = "";
        if (fastAddButtons) fastAddButtons.innerHTML = "";
        shiftTypesList = [];

        if (snapshot.empty) {
            list.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="fa-solid fa-layer-group fs-2 mb-3 d-block" style="color:rgba(99,102,241,0.25);"></i>
                    <span class="small fw-medium">ยังไม่มีประเภทเวร กรุณาเพิ่มด้านซ้าย</span>
                </div>`;
        }

        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const id = docSnap.id;
            shiftTypesList.push({ id, ...t });

            // ── Shift Type List Item ──────────────────────────────────
            const item = document.createElement('div');
            item.className = "list-group-item d-flex justify-content-between align-items-center";
            item.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <div class="shift-color-dot" style="background:${t.color};box-shadow:0 3px 10px ${t.color}55;"></div>
                    <div>
                        <span class="fw-bold" style="font-size:0.95rem;">${t.name}</span>
                        ${t.hasTime
                            ? `<span class="d-block small mt-1" style="color:#94a3b8;"><i class="fa-regular fa-clock me-1"></i>${t.start} – ${t.end}</span>`
                            : `<span class="d-block small mt-1" style="color:#94a3b8;">ไม่ระบุเวลา</span>`}
                    </div>
                </div>
                <button class="btn btn-sm" style="border-radius:10px;border:1.5px solid rgba(244,63,94,0.25);background:rgba(244,63,94,0.06);width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;"
                    onclick="deleteType('${id}')" title="ลบประเภทเวร">
                    <i class="fa-solid fa-trash-can" style="font-size:0.8rem;color:#f43f5e;"></i>
                </button>`;
            list.appendChild(item);

            // ── Fast Add Buttons ──────────────────────────────────────
            if (fastAddButtons) {
                const btnFast = document.createElement('button');
                btnFast.className = "btn text-white fw-bold text-nowrap";
                btnFast.style.cssText = `
                    background:${t.color};
                    border-radius:50px;
                    padding:0.55rem 1.4rem;
                    border:none;
                    box-shadow:0 4px 14px ${t.color}55;
                    font-size:0.88rem;
                    letter-spacing:0.3px;
                    transition:all 0.2s ease;
                `;
                btnFast.innerText = t.name;
                btnFast.onmouseover = () => { btnFast.style.transform = 'translateY(-2px)'; btnFast.style.filter = 'brightness(1.1)'; };
                btnFast.onmouseout = () => { btnFast.style.transform = ''; btnFast.style.filter = ''; };
                btnFast.onclick = () => handleFastAdd(t);
                fastAddButtons.appendChild(btnFast);
            }

            // ── Modal Shift Buttons ───────────────────────────────────
            if (modalButtons) {
                const btnModal = document.createElement('button');
                btnModal.className = "btn text-white fw-bold shift-btn";
                btnModal.style.cssText = `
                    background:${t.color};
                    border-radius:50px;
                    padding:0.55rem 1.4rem;
                    border:2px solid transparent;
                    opacity:0.55;
                    font-size:0.88rem;
                    letter-spacing:0.3px;
                    transition:all 0.25s cubic-bezier(0.4,0,0.2,1);
                    box-shadow:0 4px 14px ${t.color}33;
                `;
                btnModal.innerText = t.name;
                btnModal.onclick = () => {
                    document.querySelectorAll('.shift-btn').forEach(b => {
                        b.style.opacity = '0.55';
                        b.style.transform = '';
                        b.style.borderColor = 'transparent';
                        b.style.boxShadow = `0 4px 14px ${t.color}33`;
                    });
                    btnModal.style.opacity = '1';
                    btnModal.style.transform = 'scale(1.06)';
                    btnModal.style.borderColor = 'rgba(255,255,255,0.6)';
                    btnModal.style.boxShadow = `0 8px 24px ${t.color}66`;
                    currentSelectedShiftType = { id, ...t };
                };
                modalButtons.appendChild(btnModal);
            }
        });

        if (calendar) updateSidebarSummary(calendar.view.currentStart);
    });
}

window.deleteType = async (id) => {
    if (confirm("คุณยืนยันที่จะลบประเภทเวรนี้ใช่หรือไม่?")) {
        await deleteDoc(doc(db, "shiftTypes", id));
    }
};

// ─── Calendar ─────────────────────────────────────────────────────────────────
function initCalendarView() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        firstDay: currentFirstDay,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
        height: 'auto',
        dayMaxEvents: true,
        dateClick: function (info) {
            currentSelectedDate = info.dateStr;
            document.getElementById('modalDateLabel').innerText = info.dateStr;
            document.querySelectorAll('.shift-btn').forEach(b => {
                b.style.opacity = '0.55';
                b.style.transform = '';
                b.style.borderColor = 'transparent';
            });
            currentSelectedShiftType = null;
            document.getElementById('modalNote').value = "";
            new bootstrap.Modal(document.getElementById('addEventModal')).show();
        },
        datesSet: (info) => updateSidebarSummary(info.view.currentStart),
        events: function (info, successCallback) {
            const apiEvents = allHolidays.map(h => ({
                start: h.date, title: `🇹🇭 ${h.localName}`, allDay: true,
                display: 'block',
                backgroundColor: 'rgba(244,63,94,0.08)',
                borderColor: 'rgba(244,63,94,0.3)',
                textColor: '#e11d48',
                className: 'holiday-event',
                extendedProps: { isHoliday: true }
            }));

            const customEvents = customHolidaysData.map(h => ({
                start: h.date, title: `🌴 ${h.name}`, allDay: true,
                display: 'block',
                backgroundColor: 'rgba(99,102,241,0.08)',
                borderColor: 'rgba(99,102,241,0.3)',
                textColor: '#4338ca',
                className: 'holiday-event',
                extendedProps: { isHoliday: true }
            }));

            const shiftEvents = allShiftsData.map(d => ({
                id: d.id, title: d.name, start: d.date,
                backgroundColor: d.color,
                borderColor: 'transparent',
                textColor: '#ffffff',
                extendedProps: { shiftId: d.id, note: d.note || "", isHoliday: false }
            }));

            successCallback([...apiEvents, ...customEvents, ...shiftEvents]);
        },
        eventClick: async function (info) {
            if (info.event.extendedProps.isHoliday) return;
            const noteText = info.event.extendedProps.note ? `\n\n📝 โน้ต: ${info.event.extendedProps.note}` : "";
            if (confirm(`เวร: ${info.event.title}${noteText}\n\nต้องการลบเวรนี้ออกจากปฏิทินใช่หรือไม่?`)) {
                await deleteDoc(doc(db, "shifts", info.event.extendedProps.shiftId));
            }
        }
    });
    calendar.render();
    window.calendarInstance = calendar;
}

document.getElementById('modalSaveBtn').addEventListener('click', async () => {
    if (!currentSelectedShiftType) return alert("กรุณาเลือกประเภทเวรก่อนทำการบันทึก");
    await addDoc(collection(db, "shifts"), {
        date: currentSelectedDate,
        name: currentSelectedShiftType.name,
        color: currentSelectedShiftType.color,
        time: currentSelectedShiftType.hasTime ? `${currentSelectedShiftType.start}-${currentSelectedShiftType.end}` : "",
        note: document.getElementById('modalNote').value
    });
    bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
});

// ─── Sidebar Summary ──────────────────────────────────────────────────────────
function updateSidebarSummary(startDate) {
    if (!startDate) return;
    const m = startDate.getMonth();
    const y = startDate.getFullYear();
    const summary = {};

    shiftTypesList.forEach(type => { summary[type.name] = { count: 0, color: type.color }; });
    allShiftsData.forEach(data => {
        const dDate = new Date(data.date);
        if (dDate.getMonth() === m && dDate.getFullYear() === y) {
            if (summary[data.name]) summary[data.name].count++;
            else summary[data.name] = { count: 1, color: data.color || '#6c757d' };
        }
    });

    const sumBox = document.getElementById('summaryList');
    if (sumBox) {
        const entries = Object.entries(summary).filter(([, s]) => s.count > 0);
        if (entries.length === 0) {
            sumBox.innerHTML = `
                <div class="text-center py-4">
                    <i class="fa-solid fa-calendar-xmark fs-3 mb-2 d-block" style="color:rgba(99,102,241,0.2);"></i>
                    <span class="small fw-medium" style="color:#94a3b8;">เดือนนี้ยังไม่มีเวร</span>
                </div>`;
        } else {
            sumBox.innerHTML = entries.map(([key, s]) => `
                <div class="d-flex justify-content-between align-items-center mb-2 px-3 py-2 rounded-3"
                     style="background:${s.color}0d;border-left:3px solid ${s.color};">
                    <div class="d-flex align-items-center gap-2">
                        <div style="width:10px;height:10px;border-radius:50%;background:${s.color};box-shadow:0 2px 6px ${s.color}66;flex-shrink:0;"></div>
                        <span class="fw-semibold" style="font-size:0.88rem;color:#1e1b4b;">${key}</span>
                    </div>
                    <span class="fw-bold rounded-pill px-3 py-1 text-white" 
                          style="background:${s.color};font-size:0.8rem;box-shadow:0 3px 10px ${s.color}44;">
                        ${s.count}
                    </span>
                </div>`).join('');
        }
    }

    // ── Holiday sidebar ───────────────────────────────────────────────────────
    const holBox = document.getElementById('holidayList');
    if (holBox) {
        holBox.innerHTML = "";

        allHolidays.forEach(h => {
            const hDate = new Date(h.date);
            if (hDate.getMonth() === m && hDate.getFullYear() === y) {
                holBox.innerHTML += `
                    <li class="list-group-item border-0 px-0 py-1">
                        <div class="d-flex align-items-center gap-2 px-3 py-2 rounded-3"
                             style="background:rgba(244,63,94,0.06);border-left:3px solid rgba(244,63,94,0.5);">
                            <span style="font-size:0.82rem;color:#e11d48;font-weight:600;">
                                <i class="fa-solid fa-flag me-1" style="font-size:0.75rem;"></i>
                                ${hDate.getDate()} ${hDate.toLocaleDateString('th-TH',{month:'short'})} – ${h.localName}
                            </span>
                        </div>
                    </li>`;
            }
        });

        customHolidaysData.forEach(h => {
            const hDate = new Date(h.date);
            if (hDate.getMonth() === m && hDate.getFullYear() === y) {
                holBox.innerHTML += `
                    <li class="list-group-item border-0 px-0 py-1">
                        <div class="d-flex align-items-center gap-2 px-3 py-2 rounded-3"
                             style="background:rgba(99,102,241,0.06);border-left:3px solid rgba(99,102,241,0.4);">
                            <span style="font-size:0.82rem;color:#4338ca;font-weight:600;">
                                <i class="fa-solid fa-umbrella-beach me-1" style="font-size:0.75rem;"></i>
                                ${hDate.getDate()} ${hDate.toLocaleDateString('th-TH',{month:'short'})} – ${h.name}
                            </span>
                        </div>
                    </li>`;
            }
        });

        if (holBox.innerHTML === "") {
            holBox.innerHTML = `
                <li class="list-group-item border-0 px-0">
                    <div class="text-center py-3 rounded-3" style="background:rgba(99,102,241,0.04);">
                        <span class="small fw-medium" style="color:#94a3b8;">ไม่มีวันหยุดในเดือนนี้</span>
                    </div>
                </li>`;
        }
    }
}

// ─── Export ───────────────────────────────────────────────────────────────────
window.exportToImage = async () => {
    const targetElement = document.getElementById('calendarCaptureArea');
    const original = targetElement.style.boxShadow;
    targetElement.style.boxShadow = 'none';
    try {
        const canvas = await html2canvas(targetElement, { scale: 2 });
        const link = document.createElement('a');
        link.download = `ตารางเวรรังสี_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึกรูปภาพ: " + err); }
    targetElement.style.boxShadow = original;
};

window.exportToICal = () => {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Radiology Shift Pro//TH\n";
    allShiftsData.forEach(shift => {
        const d = new Date(shift.date);
        const dtStart = d.toISOString().split('T')[0].replace(/-/g, '');
        d.setDate(d.getDate() + 1);
        const dtEnd = d.toISOString().split('T')[0].replace(/-/g, '');
        ics += `BEGIN:VEVENT\nDTSTART;VALUE=DATE:${dtStart}\nDTEND;VALUE=DATE:${dtEnd}\nSUMMARY:เวร ${shift.name}\n`;
        if (shift.time || shift.note) {
            let desc = "";
            if (shift.time) desc += `เวลา: ${shift.time} `;
            if (shift.note) desc += `(โน้ต: ${shift.note})`;
            ics += `DESCRIPTION:${desc.trim()}\n`;
        }
        ics += "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    link.download = 'radiology_shifts.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
