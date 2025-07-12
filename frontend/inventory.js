// Import Firebase modules from your config and Firestore functions from CDN
import { auth, db } from "../backend/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// DOM Elements
const form = document.getElementById('add-item-form');
const tableBody = document.querySelector('#inventory-table tbody');

// Track edit state
let editingId = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to access your inventory.");
    window.location.href = "../login.html";
    return;
  }

  loadInventory(user.uid);

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

    if (editingId) {
      // Update existing item
      await updateDoc(doc(db, "users", user.uid, "inventory", editingId), item);
      editingId = null;
      form.querySelector('button[type="submit"]').textContent = "Add Item";
    } else {
      // Add new item
      await addDoc(collection(db, "users", user.uid, "inventory"), item);
    }
    form.reset();
    loadInventory(user.uid);
  });
});

// Function to load inventory for a user
async function loadInventory(uid) {
  tableBody.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "users", uid, "inventory"));
  querySnapshot.forEach((docSnap) => {
    const item = docSnap.data();
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
      <td>
        <button class="edit-btn" data-id="${docSnap.id}">Edit</button>
        <button class="delete-btn" data-id="${docSnap.id}">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  // Attach event listeners for edit and delete
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      const docRef = doc(db, "users", auth.currentUser.uid, "inventory", id);
      const docSnap = await getDocs(collection(db, "users", auth.currentUser.uid, "inventory"));
      // Find the correct doc
      let itemData = null;
      docSnap.forEach(d => {
        if (d.id === id) itemData = d.data();
      });
      if (itemData) {
        document.getElementById('item-ID').value = itemData.itemID;
        document.getElementById('item-name').value = itemData.itemName;
        document.getElementById('item-desc').value = itemData.description;
        document.getElementById('item-category').value = itemData.category;
        document.getElementById('item-qty').value = itemData.quantity;
        document.getElementById('item-price').value = itemData.price;
        document.getElementById('item-supplier').value = itemData.supplier;
        document.getElementById('item-location').value = itemData.location;
        editingId = id;
        form.querySelector('button[type="submit"]').textContent = "Update Item";
      }
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.getAttribute('data-id');
      if (confirm("Are you sure you want to delete this item?")) {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "inventory", id));
        loadInventory(auth.currentUser.uid);
      }
    });
  });
}