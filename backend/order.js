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
    tableBody.innerHTML = `<tr><td colspan="8">No orders found.</td></tr>`;
    return;
  }
  ordersSnap.forEach((docSnap) => {
    const order = docSnap.data();
    const orderId = docSnap.id;
    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    let globalProcurementId = order.globalProcurementId || (order.acceptedOffer && order.acceptedOffer.globalProcurementId) || null;

    // --- FIX: Use correct quantity field ---
    let quantity = order.quantity ?? order.requestedQty ?? (order.acceptedOffer && order.acceptedOffer.requestedQty) ?? "-";

    // Show the order status, then the Track button
    let statusCell = `${order.status} <button onclick="window.showTracking('${uid}', '${orderId}', '${globalProcurementId}')">Track</button>`;
    if (order.status === "delivered" && globalProcurementId) {
      statusCell += ` <button onclick="window.markProcurementFulfilled('${uid}','${orderId}', '${globalProcurementId}')"
        style="margin-left:8px;">Mark as Fulfilled & Update Inventory</button>`;
    }

    tableBody.innerHTML += `
      <tr>
        <td>${orderId}</td>
        <td>${order.itemName}</td>
        <td>${quantity}</td>
        <td>${order.supplier}</td>
        <td>₹${order.price}</td>
        <td>${order.details}</td>
        <td>${statusCell}</td>
        <td>${date.toLocaleString()}</td>
      </tr>
    `;
  });
}

window.markProcurementFulfilled = async (uid, globalProcurementId, globalOrderId) => {
  // 1. Mark as fulfilled in globalProcurementRequests
  const globalQuery = query(
    collection(db, "globalProcurementRequests"),
    where("globalProcurementId", "==", globalProcurementId)
  );
  const globalSnap = await getDocs(globalQuery);
  for (const globalDoc of globalSnap.docs) {
    await updateDoc(doc(db, "globalProcurementRequests", globalDoc.id), { fulfilled: true });
  }

  // 2. Mark as fulfilled in user's procurementRequests
  const userReqQuery = query(
    collection(db, "users", uid, "procurementRequests"),
    where("globalProcurementId", "==", globalProcurementId)
  );
  const userReqSnap = await getDocs(userReqQuery);
  let itemID = null;
  for (const userDoc of userReqSnap.docs) {
    await updateDoc(doc(db, "users", uid, "procurementRequests", userDoc.id), { fulfilled: true });
    itemID = userDoc.data().itemID;
  }

  // 3. Update inventory
  if (itemID) {
    const newQty = prompt("Enter new stock quantity after procurement:");
    if (newQty) {
      const inventoryQuery = query(collection(db, "users", uid, "inventory"), where("itemID", "==", itemID));
      const invSnap = await getDocs(inventoryQuery);
      for (const docRef of invSnap.docs) {
        await updateDoc(doc(db, "users", uid, "inventory", docRef.id), { quantity: Number(newQty) });
      }
    }
  }

  // 4. Mark as fulfilled in globalOrders
  if (globalOrderId) {
    await updateDoc(doc(db, "globalOrders", globalOrderId), { status: "fulfilled" });
  } else {
    // Try to find globalOrderId from user's orders
    const ordersQuery = query(
      collection(db, "users", uid, "orders"),
      where("globalProcurementId", "==", globalProcurementId)
    );
    const ordersSnap = await getDocs(ordersQuery);
    for (const orderDoc of ordersSnap.docs) {
      const orderData = orderDoc.data();
      if (orderData.globalOrderId) {
        await updateDoc(doc(db, "globalOrders", orderData.globalOrderId), { status: "fulfilled" });
      }
    }
  }

  // 5. Mark as fulfilled in user's orders
  const ordersQuery2 = query(
    collection(db, "users", uid, "orders"),
    where("globalProcurementId", "==", globalProcurementId)
  );
  const ordersSnap2 = await getDocs(ordersQuery2);
  for (const orderDoc of ordersSnap2.docs) {
    await updateDoc(doc(db, "users", uid, "orders", orderDoc.id), { status: "fulfilled" });
  }

  alert("Procurement marked as fulfilled and updated inventory successfully.");
  loadOrders(uid);
};

window.showTracking = async (uid, orderId, globalProcurementId) => {
  // Fetch order
  const orderRef = doc(db, "users", uid, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) return;
  const order = orderSnap.data();

  // Try to get globalOrderId
  const globalOrderId = order.globalOrderId || null;

  // Fetch tracking from globalOrders if available
  let tracking = order.tracking || [];
  let status = order.status;
  if (globalOrderId) {
    const globalOrderRef = doc(db, "globalOrders", globalOrderId);
    const globalOrderSnap = await getDoc(globalOrderRef);
    if (globalOrderSnap.exists()) {
      const globalOrder = globalOrderSnap.data();
      tracking = globalOrder.tracking || tracking;
      status = globalOrder.status || status;
    }
  }

  // Build tracking UI (use modal style)
  let markFulfilledBtn = "";
  if (
    (status === "delivered" || status === "Delivered") &&
    globalProcurementId
  ) {
    markFulfilledBtn = `
      <div style="margin-top:14px;">
        <button class="pill-btn accept" onclick="window.markProcurementFulfilled('${uid}','${globalProcurementId}','${globalOrderId}')">
          Mark as Fulfilled & Update Inventory
        </button>
      </div>
    `;
  }

  let html = `
    <div class="popup-content">
      <button class="close-btn" onclick="document.getElementById('order-tracking-popup').remove()">&times;</button>
      <h2>Order Tracking</h2>
      <div style="margin-bottom:16px;">
        <b>Order ID:</b> ${orderId}<br>
        <b>Item:</b> ${order.itemName}<br>
        <b>Current Status:</b> ${status}
        ${markFulfilledBtn}
      </div>
      <h3>Updates:</h3>
      <table>
        <thead>
          <tr><th>Date</th><th>Status</th><th>Note</th></tr>
        </thead>
        <tbody>
          ${tracking.map(t => `
            <tr>
              <td>${t.date ? (t.date.toDate ? t.date.toDate().toLocaleString() : new Date(t.date).toLocaleString()) : "-"}</td>
              <td>${t.status}</td>
              <td>${t.note || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  // --- FIX: Use modal overlay with .popup class ---
  let popup = document.createElement('div');
  popup.id = 'order-tracking-popup';
  popup.className = 'popup';
  popup.innerHTML = html;
  document.body.appendChild(popup);
};

// Utility: Sync all user orders with the latest global order data
async function syncOrdersWithGlobal(globalOrderId) {
  // Get the latest global order data
  const globalOrderRef = doc(db, "globalOrders", globalOrderId);
  const globalOrderSnap = await getDoc(globalOrderRef);
  if (!globalOrderSnap.exists()) return;
  const globalOrder = globalOrderSnap.data();

  // Find all user orders referencing this globalOrderId (dealer and supplier)
  const ordersQuery = query(
    collectionGroup(db, "orders"),
    where("globalOrderId", "==", globalOrderId)
  );
  const ordersSnap = await getDocs(ordersQuery);
  for (const docSnap of ordersSnap.docs) {
    await updateDoc(docSnap.ref, {
      status: globalOrder.status,
      tracking: globalOrder.tracking
    });
  }

  // Also update supplier's orderFulfilment if you use it
  const fulfilQuery = query(
    collectionGroup(db, "orderFulfilment"),
    where("globalOrderId", "==", globalOrderId)
  );
  const fulfilSnap = await getDocs(fulfilQuery);
  for (const docSnap of fulfilSnap.docs) {
    await updateDoc(docSnap.ref, {
      status: globalOrder.status,
      tracking: globalOrder.tracking
    });
  }
}