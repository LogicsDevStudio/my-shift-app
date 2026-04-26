import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ⚠️ นำ firebaseConfig ของคุณมาวางแทนที่ตรงนี้ทั้งหมด
const firebaseConfig = {
  apiKey: "AIzaSyC6mr7_SuaFlc9R_kv8y9lc6rfKkMVv4-U",
  authDomain: "radiologyshift.firebaseapp.com",
  projectId: "radiologyshift",
  storageBucket: "radiologyshift.firebasestorage.app",
  messagingSenderId: "1085770244333",
  appId: "1:1085770244333:web:b7e635cb2f557bc26e6ce4"
};

// เริ่มต้นการเชื่อมต่อ Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const saveBtn = document.getElementById('saveBtn');
const shiftList = document.getElementById('shiftList');

// ฟังก์ชันบันทึกข้อมูล
saveBtn.addEventListener('click', async () => {
    const date = document.getElementById('dateInput').value;
    const shiftSelect = document.getElementById('shiftInput');
    const shiftName = shiftSelect.value;
    const shiftTime = shiftSelect.options[shiftSelect.selectedIndex].dataset.time;
    const shiftColor = shiftSelect.options[shiftSelect.selectedIndex].dataset.color;

    if (!date) {
        alert("กรุณาเลือกวันที่");
        return;
    }

    saveBtn.innerText = "กำลังบันทึก...";
    
    try {
        await addDoc(collection(db, "shifts"), {
            date: date,
            shiftName: shiftName,
            time: shiftTime,
            bgColor: shiftColor,
            timestamp: new Date()
        });
        alert("บันทึกเรียบร้อย!");
        loadShifts(); // รีโหลดข้อมูลมาแสดงใหม่
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("เกิดข้อผิดพลาดในการบันทึก");
    }
    
    saveBtn.innerText = "บันทึกเวร";
});

// ฟังก์ชันดึงข้อมูลมาแสดงผล
async function loadShifts() {
    shiftList.innerHTML = "กำลังโหลดข้อมูล...";
    const q = query(collection(db, "shifts"), orderBy("date", "asc"));
    
    try {
        const querySnapshot = await getDocs(q);
        shiftList.innerHTML = "";
        
        if (querySnapshot.empty) {
            shiftList.innerHTML = "ยังไม่มีข้อมูลเวร";
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'shift-item';
            div.innerHTML = `<strong>${data.date}</strong> : ${data.shiftName} (${data.time})`;
            shiftList.appendChild(div);
        });
    } catch (e) {
        console.error("Error loading documents: ", e);
        shiftList.innerHTML = "เกิดข้อผิดพลาดในการโหลดข้อมูล";
    }
}

// เรียกใช้ฟังก์ชันโหลดข้อมูลทันทีเมื่อเปิดเว็บ
loadShifts();
