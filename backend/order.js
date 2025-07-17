import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
    let procurementId = order.procurementId || (order.acceptedOffer && order.acceptedOffer.procurementId) || null;

    // Build status cell with button if eligible
    let statusCell = order.status;
    if (order.status === "ordered" && procurementId) {
      statusCell += ` <button onclick="window.markProcurementFulfilled('${uid}', '${procurementId}')"
        style="margin-left:8px;">Mark as Fulfilled & Update Inventory</button>`;
    }

    tableBody.innerHTML += `
      <tr>
        <td>${order.itemID}</td>
        <td>${order.itemName}</td>
        <td>${order.quantity}</td>
        <td>${order.supplier}</td>
        <td>₹${order.price}</td>
        <td>${order.details}</td>
        <td>${statusCell}</td>
        <td>${date.toLocaleString()}</td>
      </tr>
    `;
  });
}

window.markProcurementFulfilled = async (uid, procurementId) => {
  // Mark procurement request as fulfilled in user's collection
  const procurementRef = doc(db, "users", uid, "procurementRequests", procurementId);
  await updateDoc(procurementRef, { fulfilled: true });

  // Also mark as fulfilled in global procurementRequests collection
  const globalQuery = query(
    collection(db, "procurementRequests"),
    where("requestId", "==", procurementId)
  );
  const globalSnap = await getDocs(globalQuery);
  for (const globalDoc of globalSnap.docs) {
    await updateDoc(doc(db, "procurementRequests", globalDoc.id), { fulfilled: true });
  }

  alert("Procurement marked as fulfilled. Please update your inventory quantity.");

  // Find the itemID from the procurement request
  const procurementSnap = await getDoc(procurementRef);
  let itemID = null;
  if (procurementSnap.exists()) {
    itemID = procurementSnap.data().itemID;
  }
  const newQty = prompt("Enter new stock quantity after procurement:");
  if (newQty && itemID) {
    const inventoryQuery = query(collection(db, "users", uid, "inventory"), where("itemID", "==", itemID));
    const invSnap = await getDocs(inventoryQuery);
    for (const docRef of invSnap.docs) {
      await updateDoc(doc(db, "users", uid, "inventory", docRef.id), { quantity: Number(newQty) });
    }
  }

  // Mark the order status as fulfilled
  const ordersQuery = query(
    collection(db, "users", uid, "orders"),
    where("procurementId", "==", procurementId)
  );
  const ordersSnap = await getDocs(ordersQuery);
  for (const orderDoc of ordersSnap.docs) {
    await updateDoc(doc(db, "users", uid, "orders", orderDoc.id), { status: "fulfilled" });
  }

  // Optionally reload orders table to reflect changes
  loadOrders(uid);
};