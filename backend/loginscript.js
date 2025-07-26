// Import Firebase modules
import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { updateDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
// Import Firebase Storage for profile picture upload

console.log("loginscript.js loaded");

// Initialize Firestore
const db = getFirestore();

// DOM Elements
const fileInput = document.getElementById('profile-upload');
const profilePic = document.getElementById('profile-pic');
const form = document.getElementById('upload-form');
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const forgotPasswordLink = document.getElementById("forgotPassword");
const createAccountLink = document.getElementById("createAccount");

// Handle Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        errorMessage.textContent = "Please enter both email and password.";
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Login Successful:", user);

        // Optional: Fetch user data if needed
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            errorMessage.textContent = "User not found in database!";
            return;
        }

        // Redirect all users to the same dashboard
        window.location.href = "frontend/index.html";
    } catch (error) {
        errorMessage.textContent = "Invalid email or password.";
        console.error("Login error:", error);
    }
});

// Handle Password Reset
forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const email = prompt("Enter your email to reset password:");
    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Password reset email sent! Check your inbox.");
        } catch (error) {
            alert("Error sending reset email. Make sure your email is correct.");
            console.error("Password reset error:", error);
        }
    }
});
fileInput.addEventListener('change', async () => {
    const user = auth.currentUser;

    if (!user) {
        alert("You must be logged in to upload a profile picture.");
        return;
    }

    const formData = new FormData();
    const file = fileInput.files[0];
    
    if (!file) return;

    // Rename file to user's UID + .jpg (or keep original name)
    const renamedFile = new File([file], `${user.uid}.jpg`, { type: file.type });

    formData.append('avatar', renamedFile);

    try {
        const res = await fetch('/upload-avatar', {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (data.success && data.imagePath) {
            profilePic.src = data.imagePath;

            // Update Firestore with new profile image path
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { profileImage: data.imagePath });

            console.log("Profile image updated in Firestore.");
        } else {
            alert('Upload failed');
        }
    } catch (err) {
        console.error('Error uploading image:', err);
    }
});


// Redirect to Register Page
createAccountLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "registry.html";
});
