/* =========================================================
   ตั้งค่า Firebase (ใช้โปรเจกต์เดียวกับเว็บกีฬาภายใน แต่เก็บข้อมูลแยก collection "pmeet")
   ถ้า apiKey ว่าง ระบบจะทำงานใน "โหมดทดลอง" (เก็บข้อมูลในเบราว์เซอร์เครื่องนี้เท่านั้น)
   adminEmail ต้องตรงกับอีเมลใน firestore.rules
   ========================================================= */
window.PMEET_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDqdTKa19cD8ApUBuoUdGM-2AW_zG_CPa8",
    authDomain: "sportday69-c54a4.firebaseapp.com",
    projectId: "sportday69-c54a4",
    storageBucket: "sportday69-c54a4.firebasestorage.app",
    messagingSenderId: "209083969462",
    appId: "1:209083969462:web:8449f8011865e4bd501b17"
  },
  adminEmail: "waroon01@gmail.com"
};
