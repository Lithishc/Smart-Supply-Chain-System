import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, query,where } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

    // --- Find related order ---
    let orderStatus = "-";
    let orderId = null;
    if (offerId) {
      const ordersSnap = await getDocs(collection(db, "users", uid, "orders"));
      for (const orderDoc of ordersSnap.docs) {
        const order = orderDoc.data();
        if (order.offerId === offerId) {
          orderStatus = order.status || "-";
          orderId = orderDoc.id;
          break;
        }
      }
    }

    // --- Make orderId clickable if exists ---
    let orderStatusCell = orderId
      ? `<a href="#" class="order-link" data-order-id="${orderId}" data-global-id="${offer.globalProcurementId}">${orderId}</a>`
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
        const orderId = this.getAttribute('data-order-id');
        const globalId = this.getAttribute('data-global-id');
        window.UpdateTracking(auth.currentUser.uid, orderId, globalId);
      });
    });
  }, 100);
}


window.UpdateTracking = async (uid, orderId, globalProcurementId) => {
  // Fetch order
  const orderRef = doc(db, "users", uid, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) return;
  const order = orderSnap.data();

  // Fetch tracking history (array of {status, date, location, note})
  let tracking = order.tracking || [];
  // Default statuses
  const statusOptions = [
    "Preparing to Ship",
    "Shipped",
    "in Transit",
    "Out for Delivery",
    "Delivered"
  ];

  // Build tracking UI
  let html = `
    <div style="padding:24px;max-width:600px;background:#fff;border-radius:18px;box-shadow:0 4px 24px #0001;">
      <h2>Order Tracking</h2>
      <div style="margin-bottom:16px;">
        <b>Order ID:</b> ${orderId}<br>
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
      <table style="width:100%;margin-bottom:12px;">
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
  popup.style.position = 'fixed';
  popup.style.top = '0';
  popup.style.left = '0';
  popup.style.width = '100vw';
  popup.style.height = '100vh';
  popup.style.background = 'rgba(0,0,0,0.25)';
  popup.style.display = 'flex';
  popup.style.alignItems = 'center';
  popup.style.justifyContent = 'center';
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

    // Update in user's orders
    await updateDoc(orderRef, { status: newStatus, tracking: newTracking });

    // Update in user's procurementRequests
    if (globalProcurementId) {
      const userReqQuery = query(
        collection(db, "users", uid, "procurementRequests"),
        where("globalProcurementId", "==", globalProcurementId)
      );
      const userReqSnap = await getDocs(userReqQuery);
      for (const userDoc of userReqSnap.docs) {
        await updateDoc(doc(db, "users", uid, "procurementRequests", userDoc.id), {
          status: newStatus,
          tracking: newTracking
        });
      }

      // Update in global procurementRequests
      const globalQuery = query(
        collection(db, "globalProcurementRequests"),
        where("globalProcurementId", "==", globalProcurementId)
      );
      const globalSnap = await getDocs(globalQuery);
      for (const globalDoc of globalSnap.docs) {
        await updateDoc(doc(db, "globalProcurementRequests", globalDoc.id), {
          status: newStatus,
          tracking: newTracking
        });
      }
    }

    alert("Order status updated!");
    document.getElementById('order-tracking-popup').remove();
    loadOffers(uid);
  };
};