import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const tableBody = document.querySelector('#orders-table tbody');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to view orders.");
    window.location.href = "../login.html";
    return;
  }
  loadOrders(user.uid);
});

async function loadOrders(uid) {
  tableBody.innerHTML = "";
  const ordersSnap = await getDocs(collection(db, "users", uid, "orders"));
  if (ordersSnap.empty) {
    tableBody.innerHTML = `<tr><td colspan="7">No orders found.</td></tr>`;
    return;
  }
  ordersSnap.forEach((docSnap) => {
    const order = docSnap.data();
    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    tableBody.innerHTML += `
      <tr>
        <td>${order.itemName}</td>
        <td>${order.quantity}</td>
        <td>${order.supplier}</td>
        <td>₹${order.price}</td>
        <td>${order.details}</td>
        <td>${order.status}</td>
        <td>${date.toLocaleString()}</td>
      </tr>
    `;
  });
}