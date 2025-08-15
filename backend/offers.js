import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, query,where,collectionGroup } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const tableBody = document.querySelector('#offers-table tbody');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to view your offers.");
    window.location.href = "../login.html";
    return;
  }
  loadOffers(user.uid);
});

async function loadOffers(uid) {
  tableBody.innerHTML = "";
  const offersSnap = await getDocs(collection(db, "users", uid, "offers"));
  if (offersSnap.empty) {
    tableBody.innerHTML = `<tr><td colspan="7">No offers made yet.</td></tr>`;
    return;
  }
  for (const docSnap of offersSnap.docs) {
    const offer = docSnap.data();
    const offerId = docSnap.id; // Always use the document ID as offerId
    const date = offer.createdAt?.toDate ? offer.createdAt.toDate() : new Date(offer.createdAt);

    // --- Get item name from global procurement request ---
    let itemName = "-";
    if (offer.globalProcurementId) {
      const globalReqRef = doc(db, "globalProcurementRequests", offer.globalProcurementId);
      const globalReqSnap = await getDoc(globalReqRef);
      if (globalReqSnap.exists()) {
        const globalReq = globalReqSnap.data();
        itemName = globalReq.itemName || "-";
      }
    }

    // --- Find related global order ---
    let orderStatus = "-";
    let globalOrderId = offer.globalOrderId || null;
    if (globalOrderId) {
      const globalOrderRef = doc(db, "globalOrders", globalOrderId);
      const globalOrderSnap = await getDoc(globalOrderRef);
      if (globalOrderSnap.exists()) {
        const globalOrder = globalOrderSnap.data();
        orderStatus = globalOrder.status || "-";
      }
    }

    // --- Make orderId clickable if exists ---
    let orderStatusCell = globalOrderId
      ? `<a href="#" class="order-link" data-order-id="${globalOrderId}" data-global-id="${offer.globalProcurementId}" data-global-order-id="${globalOrderId}">${globalOrderId}</a>`
      : "-";

    tableBody.innerHTML += `
      <tr>
        <td>${offerId}</td>
        <td>${itemName}</td>
        <td>₹${offer.price}</td>
        <td>${offer.details}</td>
        <td>
          <span class="offer-status ${offer.status}">
            ${offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
          </span>
        </td>
        <td>${orderStatusCell}</td>
        <td>${date.toLocaleString()}</td>
      </tr>
    `;
  }

  // Add event listener for all order links (after table is populated)
  setTimeout(() => {
    document.querySelectorAll('.order-link').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const globalOrderId = this.getAttribute('data-global-order-id');
        window.UpdateTracking(auth.currentUser.uid, globalOrderId);
      });
    });
  }, 100);
}


window.UpdateTracking = async (uid, globalOrderId) => {
  // Fetch global order
  const globalOrderRef = doc(db, "globalOrders", globalOrderId);
  const globalOrderSnap = await getDoc(globalOrderRef);
  if (!globalOrderSnap.exists()) return;
  const order = globalOrderSnap.data();

  // Fetch tracking history
  let tracking = order.tracking || [];
  const statusOptions = [
    "Preparing to Ship",
    "Shipped",
    "In Transit",
    "Delivered"
  ];

  let html = `
    <div>
      <button class="close-btn" onclick="document.getElementById('order-tracking-popup').remove()">&times;</button>
      <h2>Order Tracking</h2>
      <div style="margin-bottom:16px;">
        <b>Order ID:</b> ${globalOrderId}<br>
        <b>Item:</b> ${order.itemName}<br>
        <b>Current Status:</b> ${order.status}
      </div>
      <div style="margin-bottom:16px;">
        <label for="status-select">Update Status:</label>
        <select id="status-select">
          ${statusOptions.map(s => `<option value="${s}" ${order.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <button id="update-status-btn">Update</button>
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
      <button onclick="document.getElementById('order-tracking-popup').remove()">Close</button>
    </div>
  `;

  let popup = document.createElement('div');
  popup.id = 'order-tracking-popup';
  popup.innerHTML = html;
  document.body.appendChild(popup);

  // Add event listener for status update
  document.getElementById('update-status-btn').onclick = async () => {
    const newStatus = document.getElementById('status-select').value;
    const now = new Date();
    const newTracking = [
      ...(tracking || []),
      { status: newStatus, date: now, note: "" }
    ];

    // 1. Update in globalOrders
    await updateDoc(globalOrderRef, { status: newStatus, tracking: newTracking });

    // 2. Update in dealer's orders
    const dealerOrderQuery = query(
      collectionGroup(db, "orders"),
      where("globalOrderId", "==", globalOrderId)
    );
    const dealerOrderSnap = await getDocs(dealerOrderQuery);
    for (const docSnap of dealerOrderSnap.docs) {
      await updateDoc(docSnap.ref, { status: newStatus, tracking: newTracking });
    }

    // 3. Update in supplier's orderFulfilment
    const supplierOrderQuery = query(
      collectionGroup(db, "orderFulfilment"),
      where("globalOrderId", "==", globalOrderId)
    );
    const supplierOrderSnap = await getDocs(supplierOrderQuery);
    for (const docSnap of supplierOrderSnap.docs) {
      await updateDoc(docSnap.ref, { status: newStatus, tracking: newTracking });
    }

    // 4. (Optional) Update in globalProcurementRequests and procurementRequests
    if (order.globalProcurementId) {
      // globalProcurementRequests
      const globalReqQuery = query(
        collection(db, "globalProcurementRequests"),
        where("globalProcurementId", "==", order.globalProcurementId)
      );
      const globalReqSnap = await getDocs(globalReqQuery);
      for (const docRef of globalReqSnap.docs) {
        await updateDoc(doc(db, "globalProcurementRequests", docRef.id), {
          status: newStatus,
          tracking: newTracking
        });
      }
      // procurementRequests for dealer
      if (order.dealerUid) {
        const userReqQuery = query(
          collection(db, "users", order.dealerUid, "procurementRequests"),
          where("globalProcurementId", "==", order.globalProcurementId)
        );
        const userReqSnap = await getDocs(userReqQuery);
        for (const userDoc of userReqSnap.docs) {
          await updateDoc(doc(db, "users", order.dealerUid, "procurementRequests", userDoc.id), {
            status: newStatus,
            tracking: newTracking
          });
        }
      }
    }

    alert("Order status updated!");
    document.getElementById('order-tracking-popup').remove();
    loadOffers(uid);
  };
};