import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

async function loadNavbar() {
  try {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return console.error("Missing #navbar-container");

    const res = await fetch('navbar.html');
    if (!res.ok) throw new Error("Failed to load navbar.html");
    const html = await res.text();
    navbarContainer.innerHTML = html;

    // Highlight current page
    const currentPage = document.body.dataset.page;
    const activeLink = document.querySelector(`.nav-link[data-page="${currentPage}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Profile avatar logic
    const profilePic = document.getElementById('profile-pic');
    const dropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');

    if (!profilePic || !dropdown || !logoutBtn) {
      console.warn("Navbar profile elements missing.");
      return;
    }

    // Load stored profile image if available
    const storedAvatar = localStorage.getItem("profileImageURL");
    if (storedAvatar) profilePic.src = storedAvatar;

    // Toggle dropdown
    profilePic.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === "flex" ? "none" : "flex";
    });

    document.addEventListener("click", () => {
      dropdown.style.display = "none";
    });

    // Logout logic
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "login.html";
    });

    // Check auth state
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "login.html";
      } else {
        // Optional: You could load and show the user's name
        // document.getElementById("username-display").textContent = user.displayName || "User";
      }
    });

  } catch (err) {
    console.error("Navbar load failed:", err);
  }
}

loadNavbar();
