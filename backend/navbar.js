import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { app } from "./firebase-config.js"; 

const auth = getAuth(app);
const db = getFirestore(app);

export function loadNavbar() {
  fetch('navbar.html')
    .then(response => response.text())
    .then(data => {
      document.getElementById('navbar-placeholder').innerHTML = data;

      // Highlight active tab
      const path = window.location.pathname.split('/').pop();
      document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === path) {
          link.classList.add('active');
        }
      });

      // Show username and handle logout
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Fetch username from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));
          let username = "Profile";
          if (userDoc.exists()) {
            if (userDoc.data().username) {
              username = userDoc.data().username;
            } else if (userDoc.data().name) {
              username = userDoc.data().name;
            }
          } else if (user.displayName) {
            username = user.displayName;
          } else if (user.email) {
            username = user.email.split('@')[0];
          }
          const usernameSpan = document.getElementById('navbar-username');
          console.log("usernameSpan:", usernameSpan, "username:", username);
          if (usernameSpan) usernameSpan.textContent = username;
        }
      });

      // Logout functionality
      const logoutLink = document.getElementById('logout-link');
      if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
          e.preventDefault();
          await signOut(auth);
          window.location.href = "../index.html";
        });
      }
    });
}
// Sh0rtcut for loading the active navbar
/*
<div id="navbar-placeholder"></div>
<script src="navbar.js"></script>
<script>loadNavbar();</script>

or 
<div id="navbar-placeholder"></div>
<script type="module">
  import { loadNavbar } from './navbar.js';
  loadNavbar();
</script>
*/

