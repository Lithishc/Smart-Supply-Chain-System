import { auth, db } from "../backend/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, addDoc, getDocs, getDoc, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// DOM Elements
const form = document.getElementById('add-item-form');
const tableBody = document.querySelector('#inventory-table tbody');
const toggleBtn = document.getElementById('toggle-add-form-btn');

// Track edit state
let editingId = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to access your inventory.");
    window.location.href = "../login.html";
    return;
  }

  loadInventory(user.uid);

  // Toggle popout form
  toggleBtn.onclick = function() {
  if (form.style.display === '' || form.style.display === 'none') {
    form.reset();
    form.style.display = '';
    toggleBtn.textContent = 'Cancel';
  } else {
    form.reset();
    form.style.display = 'none';
    toggleBtn.textContent = 'Add Item';
  }
};

  // Add/Edit item
  form.onsubmit = async function(e) {
    e.preventDefault();
    const item = {
      itemID: document.getElementById('item-ID').value,
      itemName: document.getElementById('item-name').value,
      description: document.getElementById('item-desc').value,
      serial: document.getElementById('serial-no').value,
      category: document.getElementById('item-category').value,
      quantity: document.getElementById('item-qty').value,
      price: document.getElementById('item-price').value,
      supplier: document.getElementById('item-supplier').value,
      location: document.getElementById('item-location').value,
    };

    if (editingId) {
      await updateDoc(doc(db, "users", user.uid, "inventory", editingId), item);
      editingId = null;
      form.querySelector('button[type="submit"]').textContent = "Add Item";
    } else {
      await addDoc(collection(db, "users", user.uid, "inventory"), item);
    }
    form.reset();
    form.style.display = 'none';
    toggleBtn.textContent = 'Add Item';
    loadInventory(user.uid);
  };
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
      <td>${item.serial || ""}</td>
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
    btn.onclick = async function() {
      const id = this.getAttribute('data-id');
      const docRef = doc(db, "users", auth.currentUser.uid, "inventory", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const itemData = docSnap.data();
        document.getElementById('item-ID').value = itemData.itemID;
        document.getElementById('item-name').value = itemData.itemName;
        document.getElementById('item-desc').value = itemData.description;
        document.getElementById('serial-no').value = itemData.serial || "";
        document.getElementById('item-category').value = itemData.category;
        document.getElementById('item-qty').value = itemData.quantity;
        document.getElementById('item-price').value = itemData.price;
        document.getElementById('item-supplier').value = itemData.supplier;
        document.getElementById('item-location').value = itemData.location;
        editingId = id;
        form.querySelector('button[type="submit"]').textContent = "Update Item";
        form.style.display = '';
        toggleBtn.textContent = 'Cancel';
      }
    };
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async function() {
      const id = this.getAttribute('data-id');
      if (confirm("Are you sure you want to delete this item?")) {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "inventory", id));
        loadInventory(auth.currentUser.uid);
      }
    };
  });
}