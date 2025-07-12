// Import Firebase modules from your config and Firestore functions from CDN
import { auth, db } from "../backend/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// DOM Elements
const form = document.getElementById('add-item-form');
const tableBody = document.querySelector('#inventory-table tbody');

// Wait for user to be authenticated
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to access your inventory.");
    window.location.href = "../login.html";
    return;
  }

  // Load inventory for this user
  loadInventory(user.uid);

  // Add item event
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = {
      itemID: document.getElementById('item-ID').value,
      itemName: document.getElementById('item-name').value,
      description: document.getElementById('item-desc').value,
      category: document.getElementById('item-category').value,
      quantity: document.getElementById('item-qty').value,
      price: document.getElementById('item-price').value,
      supplier: document.getElementById('item-supplier').value,
      location: document.getElementById('item-location').value,
    };

    // Add to Firestore under users/{uid}/inventory
    await addDoc(collection(db, "users", user.uid, "inventory"), item);
    form.reset();
    loadInventory(user.uid);
  });
});

// Function to load inventory for a user
async function loadInventory(uid) {
  tableBody.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "users", uid, "inventory"));
  querySnapshot.forEach((doc) => {
    const item = doc.data();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.itemID}</td>
      <td>${item.itemName}</td>
      <td>${item.description}</td>
      <td>${item.category}</td>
      <td>${item.quantity}</td>
      <td>${item.price}</td>
      <td>${item.supplier}</td>
      <td>${item.location}</td>
    `;
    tableBody.appendChild(row);
  });
}