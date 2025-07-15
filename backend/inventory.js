// Firebase imports (ensure firebase-config.js properly exports `auth` and `db`)
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// DOM references
const toggleBtn = document.getElementById('toggle-form-btn');
const formContainer = document.getElementById('form-container');
const form = document.getElementById('add-item-form');
const tableBody = document.querySelector('#inventory-table tbody');

// Toggle form visibility
let formVisible = false;
toggleBtn.addEventListener('click', () => {
  formVisible = !formVisible;
  formContainer.style.display = formVisible ? 'block' : 'none';
  toggleBtn.textContent = formVisible ? 'Close' : 'Add Item';
});


// Add item to Firestore and UI
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('item-ID').value.trim();
  const name = document.getElementById('item-name').value.trim();
  const desc = document.getElementById('item-desc').value.trim();
  const cat = document.getElementById('item-category').value.trim();
  const qty = parseInt(document.getElementById('item-qty').value.trim());
  const price = document.getElementById('item-price').value.trim();
  const supplier = document.getElementById('item-supplier').value.trim();
  const location = document.getElementById('item-location').value.trim();

  if (!id || !name || !desc || !cat || !qty || !price || !supplier || !location) return;

  try {
    const docRef = await addDoc(collection(db, "inventory"), {
      itemId: id,
      name,
      description: desc,
      category: cat,
      quantity: qty,
      price,
      supplier,
      location
    });

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${id}</td>
      <td>${name}</td>
      <td>${desc}</td>
      <td>${cat}</td>
      <td>${qty}</td>
      <td>${price}</td>
      <td>${supplier}</td>
      <td>${location}</td>
      <td><button data-id="${docRef.id}" class="delete-btn">Delete</button></td>
    `;
    tableBody.appendChild(row);

    form.reset();
    formContainer.style.display = 'none';
    toggleBtn.textContent = 'Add Item';

  } catch (error) {
    console.error("Error adding document: ", error);
  }
});

// Handle delete clicks (from table)
tableBody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const row = e.target.closest('tr');
    const docId = e.target.getAttribute('data-id');
    try {
      await deleteDoc(doc(db, "inventory", docId));
      row.remove();
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  }
});

// Optional: load items from Firestore on page load
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const querySnapshot = await getDocs(collection(db, "inventory"));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${data.itemId}</td>
        <td>${data.name}</td>
        <td>${data.description}</td>
        <td>${data.category}</td>
        <td>${data.quantity}</td>
        <td>${data.price}</td>
        <td>${data.supplier}</td>
        <td>${data.location}</td>
        <td><button data-id="${docSnap.id}" class="delete-btn">Delete</button></td>
      `;
      tableBody.appendChild(row);
    });
  }
});
