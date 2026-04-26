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
                updateTodayStatus(); // อัปเดตสถานะวันนี้หลังจากโหลดเสร็จ
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

// --- ฟังก์ชันอัปเดตสถานะของวันนี้ (Today's Status) ---
function updateTodayStatus() {
    const statusBox = document.getElementById('todayStatusHighlight');
    if (!statusBox) return;

    // หาค่าวันที่ปัจจุบันใน Timezone ท้องถิ่น (YYYY-MM-DD)
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let statusMessages = [];
    let isHoliday = false;

    // เช็ควันหยุดราชการ
    const apiHoliday = allHolidays.find(h => h.date === localDate);
    if (apiHoliday) {
        statusMessages.push(`🇹🇭 ${apiHoliday.localName}`);
        isHoliday = true;
    }

    // เช็ควันหยุดกำหนดเอง
    const customHoliday = customHolidaysData.find(h => h.date === localDate);
    if (customHoliday) {
        statusMessages.push(`🌴 ${customHoliday.name}`);
        isHoliday = true;
    }

    // เช็คเวร
    const todayShifts = allShiftsData.filter(s => s.date === localDate);
    
    if (todayShifts.length > 0) {
        let shiftBadges = todayShifts.map(s => `<span class="badge ms-1" style="background-color: ${s.color}">${s.name}</span>`).join('');
        
        statusBox.className = "alert alert-warning shadow-sm fw-bold mb-3 d-flex align-items-center";
        let prefix = isHoliday ? `${statusMessages.join(' | ')} และมีเวร ` : `วันนี้คุณมีเวร `;
        statusBox.innerHTML = `<div><i class="fa-solid fa-user-doctor me-2 fs-5"></i> ${prefix} ${shiftBadges}</div>`;
        
    } else if (isHoliday) {
        statusBox.className = "alert alert-success shadow-sm fw-bold mb-3 d-flex align-items-center";
        statusBox.innerHTML = `<div><i class="fa-solid fa-umbrella-beach me-2 fs-5"></i> วันนี้เป็นวันหยุด: ${statusMessages.join(' | ')} (พักผ่อนได้เลย)</div>`;
    } else {
        statusBox.className = "alert alert-secondary shadow-sm fw-bold mb-3 d-flex align-items-center";
        statusBox.innerHTML = `<div><i class="fa-solid fa-mug-hot me-2 fs-5"></i> วันนี้ไม่มีเวร (พักผ่อนได้เต็มที่)</div>`;
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
    document.getElementById('saveHolidayBtn').innerText = "บันทึกวันหยุด";
    document.getElementById('cancelEditHolidayBtn').classList.add('d-none');
    document.getElementById('holidayFormTitle').innerText = "เพิ่มวันหยุดใหม่";
}

function renderCustomHolidaysAdmin() {
    const list = document.getElementById('customHolidayList');
    list.innerHTML = "";
    
    const sorted = [...customHolidaysData].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(h => {
        const dFormat = new Date(h.date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric'});
        const item = document.createElement('div');
        item.className = "list-group-item d-flex justify-content-between align-items-center border-0 mb-2 shadow-sm rounded-3 bg-light";
        item.innerHTML = `
            <div>
                <div class="fw-bold text-danger">${dFormat}</div>
                <div class="small">🌴 ${h.name}</div>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary me-1 border-0" onclick="editCustomHoliday('${h.id}', '${h.date}', '${h.name}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteCustomHoliday('${h.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

window.editCustomHoliday = (id, date, name) => {
    document.getElementById('editHolidayId').value = id;
    document.getElementById('holidayDate').value = date;
    document.getElementById('holidayName').value = name;
    document.getElementById('saveHolidayBtn').innerText = "อัปเดตวันหยุด";
    document.getElementById('cancelEditHolidayBtn').classList.remove('d-none');
    document.getElementById('holidayFormTitle').innerText = "แก้ไขวันหยุด";
};

window.deleteCustomHoliday = async (id) => {
    if(confirm("ยืนยันการลบวันหยุดนี้?")) {
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
    
    // เปลี่ยนหน้าไปที่หน้าปฏิทินแบบอัตโนมัติเพื่อให้พร้อมระบุเวร
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
        if(!data.name) return alert("ระบุชื่อเวร");
        
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
            
            const item = document.createElement('div');
            item.className = "list-group-item d-flex justify-content-between align-items-center border-0 mb-2 shadow-sm rounded-3";
            item.innerHTML = `<div><span class="badge" style="background:${t.color}">&nbsp;</span> <b>${t.name}</b> ${t.hasTime ? `<small>(${t.start}-${t.end})</small>` : ""}</div>
                              <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteType('${id}')">ลบ</button>`;
            list.appendChild(item);

            if(fastAddButtons) {
                const btnFast = document.createElement('button');
                btnFast.className = "btn text-white fw-bold text-nowrap";
                btnFast.style.backgroundColor = t.color;
                btnFast.innerText = t.name;
                btnFast.onclick = () => handleFastAdd(t);
                fastAddButtons.appendChild(btnFast);
            }

            if(modalButtons) {
                const btnModal = document.createElement('button');
                btnModal.className = "btn text-white fw-bold shift-btn";
                btnModal.style.backgroundColor = t.color;
                btnModal.style.opacity = "0.4";
                btnModal.innerText = t.name;
                
                btnModal.onclick = () => {
                    document.querySelectorAll('.shift-btn').forEach(b => b.style.opacity = "0.4");
                    btnModal.style.opacity = "1";
                    currentSelectedShiftType = { id, ...t }; 
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

function initCalendarView() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        firstDay: currentFirstDay,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
        dateClick: function(info) {
            currentSelectedDate = info.dateStr;
            document.getElementById('modalDateLabel').innerText = info.dateStr;
            document.querySelectorAll('.shift-btn').forEach(b => b.style.opacity = "0.4");
            currentSelectedShiftType = null; 
            document.getElementById('modalNote').value = "";
            new bootstrap.Modal(document.getElementById('addEventModal')).show();
        },
        datesSet: (info) => updateSidebarSummary(info.view.currentStart),
        events: function(info, successCallback) {
            const apiEvents = allHolidays.map(h => ({ 
                start: h.date, title: `🇹🇭 ${h.localName}`, allDay: true, 
                display: 'block', backgroundColor: '#ffe6e6', borderColor: '#ffcccc', textColor: '#cc0000',
                className: 'holiday-event', extendedProps: { isHoliday: true }
            }));
            
            const customEvents = customHolidaysData.map(h => ({ 
                start: h.date, title: `🌴 ${h.name}`, allDay: true, 
                display: 'block', backgroundColor: '#e6f7ff', borderColor: '#b3e0ff', textColor: '#005c99',
                className: 'holiday-event', extendedProps: { isHoliday: true }
            }));

            const shiftEvents = allShiftsData.map(d => ({
                id: d.id, title: d.name, start: d.date, backgroundColor: d.color, borderColor: d.color,
                extendedProps: { shiftId: d.id, note: d.note || "", isHoliday: false }
            }));
            
            successCallback([...apiEvents, ...customEvents, ...shiftEvents]);
        },
        eventClick: async function(info) {
            if(info.event.extendedProps.isHoliday) return; 
            
            const noteText = info.event.extendedProps.note ? `\nโน้ต: ${info.event.extendedProps.note}` : "";
            if(confirm(`เวร: ${info.event.title}${noteText}\n\nต้องการลบเวรนี้ออกจากปฏิทินใช่หรือไม่?`)) {
                await deleteDoc(doc(db, "shifts", info.event.extendedProps.shiftId));
            }
        }
    });
    calendar.render();
    
    window.calendarInstance = calendar;
}

document.getElementById('modalSaveBtn').addEventListener('click', async () => {
    if(!currentSelectedShiftType) return alert("กรุณาเลือกประเภทเวรก่อนบันทึก");
    const noteInput = document.getElementById('modalNote').value;
    
    await addDoc(collection(db, "shifts"), {
        date: currentSelectedDate, name: currentSelectedShiftType.name,
        color: currentSelectedShiftType.color,
        time: currentSelectedShiftType.hasTime ? `${currentSelectedShiftType.start}-${currentSelectedShiftType.end}` : "",
        note: noteInput
    });
    bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
});

function updateSidebarSummary(startDate) {
    if(!startDate) return;
    const m = startDate.getMonth();
    const y = startDate.getFullYear();
    const summary = {};
    shiftTypesList.forEach(type => { summary[type.name] = 0; });
    
    allShiftsData.forEach(data => {
        const dDate = new Date(data.date);
        if(dDate.getMonth() === m && dDate.getFullYear() === y) {
            if(summary.hasOwnProperty(data.name)) summary[data.name]++;
            else summary[data.name] = 1;
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

    const holBox = document.getElementById('holidayList');
    if(holBox) {
        holBox.innerHTML = "";
        
        allHolidays.forEach(h => {
            const hDate = new Date(h.date);
            if(hDate.getMonth() === m && hDate.getFullYear() === y) {
                holBox.innerHTML += `<li class="list-group-item small d-flex justify-content-between text-muted"><span>🇹🇭 ${hDate.getDate()} - ${h.localName}</span></li>`;
            }
        });
        
        customHolidaysData.forEach(h => {
            const hDate = new Date(h.date);
            if(hDate.getMonth() === m && hDate.getFullYear() === y) {
                holBox.innerHTML += `<li class="list-group-item small d-flex justify-content-between text-primary fw-bold"><span>🌴 ${hDate.getDate()} - ${h.name}</span></li>`;
            }
        });
    }
}
