import { auth } from "./firebase-config.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const db = getFirestore();
const profilePic = document.getElementById('profile-pic');
const usernameSpan = document.getElementById('username');
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      usernameSpan.textContent = data.name || user.email;

      if (data.profileImage) {
        profilePic.src = data.profileImage;
      }
    } else {
      console.warn("User document not found.");
    }
  } else {
    window.location.href = "login.html";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});
